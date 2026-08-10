import { google, type gmail_v1 } from "googleapis";
import {
  GMAIL_SEND_SCOPES,
  getImpersonatedClient,
  getWorkspaceDomain,
  isGoogleWorkspaceConfigured,
  isWorkspaceMailbox,
} from "@/lib/integrations/google-auth";
import { reportOpsFailure } from "@/lib/ops-alerts";

const LOG = "[Gmail]";

/**
 * Gmail sending and thread reading for any @jaro.dev mailbox, via the same
 * domain-wide delegated service account used for calendars.
 *
 * Every send is attributed to a real mailbox rather than a no-reply address, so
 * replies land in a human inbox and the thread stays readable for follow-ups.
 */

export function getDefaultSenderMailbox(): string {
  return (
    process.env.GMAIL_DEFAULT_SENDER || `hello@${getWorkspaceDomain()}`
  ).toLowerCase();
}

export function isGmailConfigured(): boolean {
  return isGoogleWorkspaceConfigured();
}

function getGmailClient(mailbox: string): gmail_v1.Gmail | null {
  const auth = getImpersonatedClient(mailbox, GMAIL_SEND_SCOPES);
  if (!auth) return null;
  return google.gmail({ version: "v1", auth });
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** RFC 2047 encoding so non-ASCII subjects and display names survive. */
function encodeHeaderValue(value: string): string {
  const needsEncoding = /[^\x20-\x7E]/.test(value);
  if (!needsEncoding) return value;
  return `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}

/**
 * Distinguishes a broken service account or lost delegation from an ordinary
 * rejected send, so only the former raises an operational alert.
 */
function isCredentialFailure(message: string): boolean {
  return /invalid_grant|unauthorized|forbidden|insufficient permission|access.?denied|401|403/i.test(
    message
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface SendEmailInput {
  to: string;
  subject: string;
  /** HTML body; a plain-text alternative is derived automatically. */
  html: string;
  /** Mailbox to send from. Defaults to GMAIL_DEFAULT_SENDER. */
  from?: string;
  fromName?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  /** Gmail thread to keep the message in, for sequence follow-ups. */
  threadId?: string | null;
  /** Message-ID of the message being replied to, so clients thread correctly. */
  inReplyTo?: string | null;
  /** Extra headers, e.g. List-Unsubscribe. */
  headers?: Record<string, string>;
}

export interface SentMessage {
  gmailMessageId: string;
  gmailThreadId: string;
  /** RFC Message-ID, needed to thread the next step of a sequence. */
  rfcMessageId: string | null;
}

/**
 * Builds a multipart/alternative MIME message. Plain text alongside HTML is
 * what keeps outbound mail out of spam filters that penalise HTML-only sends.
 */
function buildMimeMessage(
  input: SendEmailInput,
  sender: string
): string {
  const boundary = `----=_jaro_${Math.random().toString(36).slice(2)}`;
  const displayName = input.fromName ?? "Jaro.dev";

  const headers: string[] = [
    `From: ${encodeHeaderValue(displayName)} <${sender}>`,
    `To: ${input.to}`,
    `Subject: ${encodeHeaderValue(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  if (input.cc && input.cc.length > 0) headers.push(`Cc: ${input.cc.join(", ")}`);
  if (input.bcc && input.bcc.length > 0)
    headers.push(`Bcc: ${input.bcc.join(", ")}`);
  if (input.replyTo) headers.push(`Reply-To: ${input.replyTo}`);

  if (input.inReplyTo) {
    headers.push(`In-Reply-To: ${input.inReplyTo}`);
    headers.push(`References: ${input.inReplyTo}`);
  }

  for (const [name, value] of Object.entries(input.headers ?? {})) {
    headers.push(`${name}: ${value}`);
  }

  const text = stripHtml(input.html);

  return [
    headers.join("\r\n"),
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/**
 * Sends an email from a delegated @jaro.dev mailbox.
 *
 * Returns the Gmail ids and the RFC Message-ID so callers can thread later
 * messages onto the same conversation.
 */
export async function sendEmail(
  input: SendEmailInput
): Promise<{ data: SentMessage | null; error: string | null }> {
  try {
    const sender = (input.from ?? getDefaultSenderMailbox())
      .toLowerCase()
      .trim();

    if (!isWorkspaceMailbox(sender)) {
      return {
        data: null,
        error: `Cannot send as ${sender}: only @${getWorkspaceDomain()} mailboxes are delegated`,
      };
    }

    const gmail = getGmailClient(sender);
    if (!gmail) {
      const error = "Google service account is not configured for Gmail sending";
      // Nothing can send while this is true, so it is reported here rather than
      // left for each caller to notice on its own.
      await reportOpsFailure({
        source: "Integration: Gmail",
        summary: "Gmail is not configured; no outbound email can be sent",
        error,
        dedupeKey: "gmail not configured",
      });
      return { data: null, error };
    }

    console.log(`${LOG} sending "${input.subject}" from ${sender} to ${input.to}...`);

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodeBase64Url(buildMimeMessage(input, sender)),
        ...(input.threadId ? { threadId: input.threadId } : {}),
      },
    });

    const messageId = response.data.id;
    const threadId = response.data.threadId;

    if (!messageId || !threadId) {
      return { data: null, error: "Gmail did not return a message id" };
    }

    // The RFC Message-ID is only available by reading the sent message back
    let rfcMessageId: string | null = null;
    try {
      const sent = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "metadata",
        metadataHeaders: ["Message-ID"],
      });
      rfcMessageId =
        sent.data.payload?.headers?.find(
          (header) => header.name?.toLowerCase() === "message-id"
        )?.value ?? null;
    } catch (error) {
      console.warn(`${LOG} could not read back Message-ID for ${messageId}:`, error);
    }

    console.log(`${LOG} sent message ${messageId} in thread ${threadId}`);

    return {
      data: { gmailMessageId: messageId, gmailThreadId: threadId, rfcMessageId },
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} send failed:`, message);

    // Callers report their own per-recipient failures. Credential problems are
    // reported here instead, because they break every mailbox at once and the
    // sending path is the first place they show up.
    if (isCredentialFailure(message)) {
      await reportOpsFailure({
        source: "Integration: Gmail",
        summary: "Gmail rejected the delegated credentials; outbound email is failing",
        error: message,
        context: { mailbox: input.from ?? getDefaultSenderMailbox() },
        dedupeKey: "gmail credentials rejected",
      });
    }

    return { data: null, error: message };
  }
}

export interface ThreadMessageSummary {
  id: string;
  fromEmail: string | null;
  fromHeader: string | null;
  subject: string | null;
  internalDate: Date | null;
  labelIds: string[];
  snippet: string | null;
  isFromSender: boolean;
}

function parseEmailAddress(header: string | null | undefined): string | null {
  if (!header) return null;
  const angle = header.match(/<([^>]+)>/);
  const raw = angle ? angle[1] : header;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.includes("@") ? trimmed : null;
}

/**
 * Reads a thread from the sending mailbox so reply and bounce detection can see
 * who answered without needing a separate inbox integration.
 */
export async function getThreadMessages(
  mailbox: string,
  threadId: string
): Promise<{ data: ThreadMessageSummary[] | null; error: string | null }> {
  try {
    const sender = mailbox.toLowerCase().trim();
    const gmail = getGmailClient(sender);
    if (!gmail) {
      return { data: null, error: "Google service account is not configured" };
    }

    const thread = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Message-ID"],
    });

    const messages = (thread.data.messages ?? []).map((message) => {
      const headers = message.payload?.headers ?? [];
      const fromHeader =
        headers.find((header) => header.name?.toLowerCase() === "from")?.value ??
        null;
      const fromEmail = parseEmailAddress(fromHeader);

      return {
        id: message.id ?? "",
        fromEmail,
        fromHeader,
        subject:
          headers.find((header) => header.name?.toLowerCase() === "subject")
            ?.value ?? null,
        internalDate: message.internalDate
          ? new Date(Number(message.internalDate))
          : null,
        labelIds: message.labelIds ?? [],
        snippet: message.snippet ?? null,
        isFromSender: fromEmail === sender,
      };
    });

    return { data: messages, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} failed to read thread ${threadId}:`, message);
    return { data: null, error: message };
  }
}

export interface MailboxMessage {
  id: string;
  threadId: string | null;
  subject: string | null;
  snippet: string | null;
  internalDate: Date | null;
  fromEmail: string | null;
  toEmails: string[];
  ccEmails: string[];
  labelIds: string[];
}

/** Splits a To/Cc header, ignoring commas inside a quoted display name. */
function parseAddressList(header: string | null | undefined): string[] {
  if (!header) return [];

  return header
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((part) => parseEmailAddress(part))
    .filter((email): email is string => Boolean(email));
}

/** Gmail rejects large bursts, so message reads go out in small batches. */
const METADATA_BATCH_SIZE = 10;

/**
 * Lists messages in a delegated mailbox with just the headers the CRM needs.
 *
 * Gmail only returns ids from a list call, so each message is read back for its
 * headers. That is the expensive part, which is why callers cap `maxResults`.
 */
export async function listMailboxMessages(
  mailbox: string,
  options: { query: string; maxResults: number }
): Promise<{ data: MailboxMessage[] | null; error: string | null }> {
  try {
    const address = mailbox.toLowerCase().trim();
    const gmail = getGmailClient(address);
    if (!gmail) {
      return { data: null, error: "Google service account is not configured" };
    }

    console.log(
      `${LOG} listing up to ${options.maxResults} message(s) in ${address} matching "${options.query}"`
    );

    const ids: string[] = [];
    let pageToken: string | undefined;

    while (ids.length < options.maxResults) {
      const page = await gmail.users.messages.list({
        userId: "me",
        q: options.query,
        maxResults: Math.min(500, options.maxResults - ids.length),
        pageToken,
      });

      for (const message of page.data.messages ?? []) {
        if (message.id) ids.push(message.id);
      }

      pageToken = page.data.nextPageToken ?? undefined;
      if (!pageToken) break;
    }

    if (ids.length === 0) {
      console.log(`${LOG} ${address} has no messages matching the query`);
      return { data: [], error: null };
    }

    console.log(`${LOG} reading headers for ${ids.length} message(s) in ${address}...`);

    const messages: MailboxMessage[] = [];

    for (let i = 0; i < ids.length; i += METADATA_BATCH_SIZE) {
      const batch = await Promise.all(
        ids.slice(i, i + METADATA_BATCH_SIZE).map((id) =>
          gmail.users.messages.get({
            userId: "me",
            id,
            format: "metadata",
            metadataHeaders: ["From", "To", "Cc", "Subject"],
          })
        )
      );

      for (const response of batch) {
        const message = response.data;
        const headers = message.payload?.headers ?? [];
        const header = (name: string) =>
          headers.find((entry) => entry.name?.toLowerCase() === name)?.value ??
          null;

        messages.push({
          id: message.id ?? "",
          threadId: message.threadId ?? null,
          subject: header("subject"),
          snippet: message.snippet ?? null,
          internalDate: message.internalDate
            ? new Date(Number(message.internalDate))
            : null,
          fromEmail: parseEmailAddress(header("from")),
          toEmails: parseAddressList(header("to")),
          ccEmails: parseAddressList(header("cc")),
          labelIds: message.labelIds ?? [],
        });
      }
    }

    return { data: messages, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} failed to list messages for ${mailbox}:`, message);
    return { data: null, error: message };
  }
}

/** Verifies a mailbox can actually send, without sending anything. */
export async function verifyMailbox(
  mailbox: string
): Promise<{ data: { emailAddress: string } | null; error: string | null }> {
  try {
    const sender = mailbox.toLowerCase().trim();
    const gmail = getGmailClient(sender);
    if (!gmail) {
      return { data: null, error: "Google service account is not configured" };
    }

    console.log(`${LOG} verifying mailbox ${sender}...`);
    const profile = await gmail.users.getProfile({ userId: "me" });

    if (!profile.data.emailAddress) {
      return { data: null, error: "Gmail returned no profile" };
    }

    return { data: { emailAddress: profile.data.emailAddress }, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} mailbox verification failed for ${mailbox}:`, message);
    return { data: null, error: message };
  }
}
