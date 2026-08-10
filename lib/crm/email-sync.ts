import prisma from "@/lib/prisma";
import { logCrmActivity } from "@/lib/crm/activity";
import { recomputeEngagementForPeople } from "@/lib/crm/engagement";
import {
  isGmailConfigured,
  listMailboxMessages,
  type MailboxMessage,
} from "@/lib/integrations/gmail";
import { isWorkspaceMailbox } from "@/lib/integrations/google-auth";
import { isJaroDevTeamEmail } from "@/lib/constants";

const LOG = "[Email Sync]";

/** How far back a mailbox with no sync state reads on its first run. */
const FIRST_RUN_LOOKBACK_DAYS = 30;

/** Re-read a little before the last run, since Gmail search is second-grained. */
const OVERLAP_MS = 10 * 60_000;

/** Bounded so a cron run always finishes inside its timeout. */
const MAX_MESSAGES_PER_MAILBOX = 250;

const DAY_MS = 86_400_000;

export interface EmailSyncSummary {
  mailboxes: number;
  messagesRead: number;
  activitiesLogged: number;
  errors: string[];
}

export interface EmailSyncOptions {
  /** Overrides the incremental window, for backfills. */
  lookbackDays?: number;
  maxMessagesPerMailbox?: number;
}

/**
 * Every delegated mailbox worth reading: the ones people send sequences from
 * and the ones the recorder already watches.
 */
async function getWatchedMailboxes(): Promise<string[]> {
  const [users, rules] = await Promise.all([
    prisma.user.findMany({
      where: { sendingMailbox: { not: null } },
      select: { sendingMailbox: true },
    }),
    prisma.recordingRule.findMany({
      where: { enabled: true },
      select: { calendarEmail: true },
    }),
  ]);

  const mailboxes = new Set<string>();

  for (const address of [
    ...users.map((user) => user.sendingMailbox),
    ...rules.map((rule) => rule.calendarEmail),
  ]) {
    if (!address) continue;
    const normalised = address.toLowerCase().trim();
    if (normalised && isWorkspaceMailbox(normalised)) mailboxes.add(normalised);
  }

  return [...mailboxes];
}

/** Addresses on a message that are not us, deduplicated. */
function counterparties(message: MailboxMessage): string[] {
  const addresses = [
    message.fromEmail,
    ...message.toEmails,
    ...message.ccEmails,
  ];

  const external = new Set<string>();

  for (const address of addresses) {
    if (!address || isJaroDevTeamEmail(address) || isWorkspaceMailbox(address)) {
      continue;
    }
    external.add(address.toLowerCase().trim());
  }

  return [...external];
}

/**
 * Messages the sequence engine already put on the timeline. Logging them again
 * from Gmail would show the same send twice under a different label.
 */
async function getSequenceMessageIds(
  messageIds: string[]
): Promise<Set<string>> {
  if (messageIds.length === 0) return new Set();

  const [sent, logged] = await Promise.all([
    prisma.sequenceMessage.findMany({
      where: { gmailMessageId: { in: messageIds } },
      select: { gmailMessageId: true },
    }),
    prisma.crmActivity.findMany({
      where: {
        externalId: {
          in: messageIds.flatMap((id) => [
            `sequence-reply:${id}`,
            `sequence-bounce:${id}`,
          ]),
        },
      },
      select: { externalId: true },
    }),
  ]);

  const covered = new Set<string>();

  for (const message of sent) {
    if (message.gmailMessageId) covered.add(message.gmailMessageId);
  }
  for (const activity of logged) {
    const id = activity.externalId?.split(":")[1];
    if (id) covered.add(id);
  }

  return covered;
}

async function syncMailbox(
  mailbox: string,
  options: EmailSyncOptions,
  summary: EmailSyncSummary,
  touchedPersonIds: Set<string>
): Promise<void> {
  const now = new Date();

  const state = await prisma.mailboxSyncState.findUnique({
    where: { mailbox },
    select: { lastMessageAt: true },
  });

  const since = options.lookbackDays
    ? new Date(now.getTime() - options.lookbackDays * DAY_MS)
    : state?.lastMessageAt
      ? new Date(state.lastMessageAt.getTime() - OVERLAP_MS)
      : new Date(now.getTime() - FIRST_RUN_LOOKBACK_DAYS * DAY_MS);

  console.log(
    `${LOG} reading ${mailbox} for mail since ${since.toISOString()}...`
  );

  // Chats and drafts are not correspondence with a contact.
  const query = `-in:chats -in:drafts after:${Math.floor(since.getTime() / 1000)}`;

  const result = await listMailboxMessages(mailbox, {
    query,
    maxResults: options.maxMessagesPerMailbox ?? MAX_MESSAGES_PER_MAILBOX,
  });

  if (!result.data) {
    summary.errors.push(`${mailbox}: ${result.error}`);
    await prisma.mailboxSyncState.upsert({
      where: { mailbox },
      update: { lastError: result.error, lastSyncedAt: now },
      create: { mailbox, lastError: result.error, lastSyncedAt: now },
    });
    return;
  }

  const messages = result.data.filter((message) => message.id);
  summary.messagesRead += messages.length;

  const addresses = [
    ...new Set(messages.flatMap((message) => counterparties(message))),
  ];

  if (addresses.length === 0) {
    console.log(`${LOG} ${mailbox}: no external correspondents in this batch`);
  }

  const people = addresses.length
    ? await prisma.person.findMany({
      where: { email: { in: addresses, mode: "insensitive" } },
      select: { id: true, email: true, companyId: true },
    })
    : [];

  const personByEmail = new Map(
    people.flatMap((person) =>
      person.email ? [[person.email.toLowerCase(), person] as const] : []
    )
  );

  console.log(
    `${LOG} ${mailbox}: ${messages.length} message(s), ${personByEmail.size} of ${addresses.length} correspondent(s) are contacts`
  );

  const alreadyLogged = await getSequenceMessageIds(
    messages.map((message) => message.id)
  );

  let newestMessageAt = state?.lastMessageAt ?? null;

  for (const message of messages) {
    if (message.internalDate) {
      newestMessageAt =
        !newestMessageAt || message.internalDate > newestMessageAt
          ? message.internalDate
          : newestMessageAt;
    }

    if (alreadyLogged.has(message.id)) continue;

    const outbound = Boolean(
      message.fromEmail &&
      (isWorkspaceMailbox(message.fromEmail) ||
        isJaroDevTeamEmail(message.fromEmail))
    );

    for (const address of counterparties(message)) {
      const person = personByEmail.get(address);
      if (!person) continue;

      const activity = await logCrmActivity({
        type: outbound ? "EMAIL_SENT" : "EMAIL_RECEIVED",
        title: message.subject?.trim() || "(no subject)",
        body: message.snippet,
        personId: person.id,
        companyId: person.companyId,
        occurredAt: message.internalDate ?? now,
        payload: {
          mailbox,
          gmailThreadId: message.threadId,
          fromEmail: message.fromEmail,
        },
        externalId: `gmail:${message.id}:${person.id}`,
      });

      if (activity.data) {
        summary.activitiesLogged += 1;
        touchedPersonIds.add(person.id);
      }
    }
  }

  await prisma.mailboxSyncState.upsert({
    where: { mailbox },
    update: { lastSyncedAt: now, lastMessageAt: newestMessageAt, lastError: null },
    create: { mailbox, lastSyncedAt: now, lastMessageAt: newestMessageAt },
  });
}

/**
 * Puts the email we exchange with contacts on their CRM timeline.
 *
 * Reads each delegated @jaro.dev mailbox and records a sent or received entry
 * for every message whose counterpart is a known contact. Mail to anyone we do
 * not have a contact for is ignored, so the timeline stays a record of the
 * relationship rather than a copy of the inbox.
 */
export async function syncMailboxEmails(
  options: EmailSyncOptions = {}
): Promise<{ data: EmailSyncSummary | null; error: string | null }> {
  const summary: EmailSyncSummary = {
    mailboxes: 0,
    messagesRead: 0,
    activitiesLogged: 0,
    errors: [],
  };

  try {
    if (!isGmailConfigured()) {
      console.warn(`${LOG} Gmail is not configured, skipping`);
      return { data: summary, error: null };
    }

    const mailboxes = await getWatchedMailboxes();

    if (mailboxes.length === 0) {
      console.log(`${LOG} no delegated mailboxes to read`);
      return { data: summary, error: null };
    }

    console.log(`${LOG} syncing ${mailboxes.length} mailbox(es): ${mailboxes.join(", ")}`);

    const touchedPersonIds = new Set<string>();

    for (const mailbox of mailboxes) {
      await syncMailbox(mailbox, options, summary, touchedPersonIds);
      summary.mailboxes += 1;
    }

    if (touchedPersonIds.size > 0) {
      console.log(
        `${LOG} refreshing engagement for ${touchedPersonIds.size} contact(s)...`
      );
      const engagement = await recomputeEngagementForPeople([
        ...touchedPersonIds,
      ]);
      if (engagement.error) {
        summary.errors.push(`Engagement refresh: ${engagement.error}`);
      }
    }

    console.log(
      `${LOG} done: ${summary.messagesRead} message(s) read, ${summary.activitiesLogged} timeline entr(ies) written`
    );

    return { data: summary, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} sync failed:`, message);
    return { data: null, error: message };
  }
}
