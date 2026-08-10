import prisma from "@/lib/prisma";
import { isJaroDevTeamEmail } from "@/lib/constants";
import type {
  CrmActivityType,
  CrmConnectionStrength,
  Prisma,
} from "@prisma/client";

const LOG = "[Engagement]";

const DAY_MS = 86_400_000;

/**
 * Thresholds behind the connection strength buckets. Tunable: they are a
 * heuristic over the interactions we actually record, not a measured model.
 */
const STRONG_RECENCY_DAYS = 14;
const MEDIUM_RECENCY_DAYS = 45;
const ACTIVITY_WINDOW_DAYS = 90;
const STRONG_MIN_INTERACTIONS = 3;
const MEDIUM_MIN_INTERACTIONS = 2;

/** Activity types that count as an email touch, in either direction. */
const EMAIL_ACTIVITY_TYPES: CrmActivityType[] = [
  "EMAIL_SENT",
  "EMAIL_RECEIVED",
  "EMAIL_REPLIED",
  "SEQUENCE_STEP_SENT",
];

/** Updates are batched into transactions instead of one round trip per row. */
const WRITE_CHUNK_SIZE = 50;

export interface EngagementSignals {
  lastEmailInteractionAt: Date | null;
  lastCalendarInteractionAt: Date | null;
  /** Meetings plus email touches inside ACTIVITY_WINDOW_DAYS. */
  interactionsInWindow: number;
}

export interface EngagementSummary {
  peopleScanned: number;
  peopleUpdated: number;
  companiesScanned: number;
  companiesUpdated: number;
}

interface EngagementScope {
  personIds?: string[];
  companyIds?: string[];
}

/**
 * Buckets a record by how recently and how often we have interacted with it.
 * Null means we have no recorded interaction at all, which the CRM tables
 * render as "No contact".
 */
export function computeConnectionStrength(
  signals: EngagementSignals,
  now: Date = new Date()
): CrmConnectionStrength | null {
  const lastInteractionAt = maxDate(
    signals.lastEmailInteractionAt,
    signals.lastCalendarInteractionAt
  );

  if (!lastInteractionAt) return null;

  const daysSince = (now.getTime() - lastInteractionAt.getTime()) / DAY_MS;

  if (
    daysSince <= STRONG_RECENCY_DAYS &&
    signals.interactionsInWindow >= STRONG_MIN_INTERACTIONS
  ) {
    return "STRONG";
  }

  if (
    daysSince <= MEDIUM_RECENCY_DAYS ||
    signals.interactionsInWindow >= MEDIUM_MIN_INTERACTIONS
  ) {
    return "MEDIUM";
  }

  return "WEAK";
}

// ============================================
// Accumulators
// ============================================

interface Accumulator extends EngagementSignals {
  nextCalendarEventAt: Date | null;
  nextCalendarEventTitle: string | null;
}

function emptyAccumulator(): Accumulator {
  return {
    lastEmailInteractionAt: null,
    lastCalendarInteractionAt: null,
    nextCalendarEventAt: null,
    nextCalendarEventTitle: null,
    interactionsInWindow: 0,
  };
}

function maxDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

function sameDate(a: Date | null, b: Date | null): boolean {
  if (a === null || b === null) return a === b;
  return a.getTime() === b.getTime();
}

function noteEmail(acc: Accumulator, at: Date, windowStart: Date): void {
  acc.lastEmailInteractionAt = maxDate(acc.lastEmailInteractionAt, at);
  if (at.getTime() >= windowStart.getTime()) acc.interactionsInWindow += 1;
}

function noteMeeting(acc: Accumulator, at: Date, windowStart: Date): void {
  acc.lastCalendarInteractionAt = maxDate(acc.lastCalendarInteractionAt, at);
  if (at.getTime() >= windowStart.getTime()) acc.interactionsInWindow += 1;
}

function noteUpcoming(
  acc: Accumulator,
  at: Date,
  title: string | null
): void {
  if (acc.nextCalendarEventAt && acc.nextCalendarEventAt.getTime() <= at.getTime()) {
    return;
  }
  acc.nextCalendarEventAt = at;
  acc.nextCalendarEventTitle = title;
}

// ============================================
// Raw interaction data
// ============================================

interface EmailTouch {
  at: Date;
  email: string | null;
  personId: string | null;
  companyId: string | null;
}

interface InteractionData {
  pastMeetings: {
    startTime: Date;
    participants: string[];
    clientCompanyId: string | null;
  }[];
  upcomingEvents: {
    startTime: Date;
    title: string | null;
    attendees: string[];
  }[];
  emailTouches: EmailTouch[];
}

function emailDomain(email: string): string | null {
  const parts = email.split("@");
  return parts.length === 2 ? parts[1].toLowerCase() : null;
}

/**
 * Pulls every interaction we can attribute to a contact in one pass, so the
 * per-record work below is in-memory rather than a query per record.
 */
async function loadInteractionData(now: Date): Promise<InteractionData> {
  console.log(`${LOG} loading meetings, calendar events and email touches...`);

  const [meetings, calendarEvents, sequenceMessages, activities] =
    await Promise.all([
      prisma.meeting.findMany({
        where: { startTime: { lte: now } },
        select: { startTime: true, participants: true, clientCompanyId: true },
      }),
      // status is Google's ("confirmed" | "tentative" | "cancelled") and is
      // nullable, so cancellations are filtered in memory to avoid dropping
      // rows where it was never set.
      prisma.calendarEvent.findMany({
        where: { startTime: { gte: now } },
        orderBy: { startTime: "asc" },
        select: {
          startTime: true,
          title: true,
          attendees: true,
          status: true,
        },
      }),
      prisma.sequenceMessage.findMany({
        where: { OR: [{ sentAt: { not: null } }, { repliedAt: { not: null } }] },
        select: { toEmail: true, sentAt: true, repliedAt: true },
      }),
      prisma.crmActivity.findMany({
        where: { type: { in: EMAIL_ACTIVITY_TYPES } },
        select: { personId: true, companyId: true, occurredAt: true },
      }),
    ]);

  const emailTouches: EmailTouch[] = [];

  for (const message of sequenceMessages) {
    for (const at of [message.sentAt, message.repliedAt]) {
      if (!at) continue;
      emailTouches.push({
        at,
        email: message.toEmail,
        personId: null,
        companyId: null,
      });
    }
  }

  for (const activity of activities) {
    emailTouches.push({
      at: activity.occurredAt,
      email: null,
      personId: activity.personId,
      companyId: activity.companyId,
    });
  }

  const upcomingEvents = calendarEvents
    .filter((event) => event.status !== "cancelled")
    .map((event) => ({
      startTime: event.startTime,
      title: event.title,
      attendees: event.attendees,
    }));

  console.log(
    `${LOG} loaded ${meetings.length} past meetings, ${upcomingEvents.length} upcoming events, ${emailTouches.length} email touches`
  );

  return { pastMeetings: meetings, upcomingEvents, emailTouches };
}

// ============================================
// Recompute
// ============================================

interface PersonRow {
  id: string;
  email: string | null;
  companyId: string | null;
  lastEmailInteractionAt: Date | null;
  lastCalendarInteractionAt: Date | null;
  nextCalendarEventAt: Date | null;
  nextCalendarEventTitle: string | null;
  connectionStrength: CrmConnectionStrength | null;
}

interface CompanyRow {
  id: string;
  domain: string | null;
  domains: string[];
  lastEmailInteractionAt: Date | null;
  lastCalendarInteractionAt: Date | null;
  nextCalendarEventAt: Date | null;
  nextCalendarEventTitle: string | null;
  connectionStrength: CrmConnectionStrength | null;
}

/**
 * Recomputes the denormalised engagement columns on Person and Company.
 *
 * Contacts are matched to meetings and calendar events by email address,
 * because neither Meeting.participants nor CalendarEvent.attendees has a
 * foreign key to Person. Companies resolve through their people, their own
 * meetings, and email domain matches.
 */
async function recomputeEngagement(
  scope: EngagementScope = {}
): Promise<{ data: EngagementSummary | null; error: string | null }> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - ACTIVITY_WINDOW_DAYS * DAY_MS);
    const isFullRun = !scope.personIds && !scope.companyIds;

    console.log(
      `${LOG} starting ${isFullRun ? "full" : "scoped"} recompute...`
    );

    // People in scope, plus every person belonging to a company in scope so
    // company rollups stay consistent with their contacts.
    const people: PersonRow[] = await prisma.person.findMany({
      where: isFullRun
        ? undefined
        : {
          OR: [
            ...(scope.personIds ? [{ id: { in: scope.personIds } }] : []),
            ...(scope.companyIds
              ? [{ companyId: { in: scope.companyIds } }]
              : []),
          ],
        },
      select: {
        id: true,
        email: true,
        companyId: true,
        lastEmailInteractionAt: true,
        lastCalendarInteractionAt: true,
        nextCalendarEventAt: true,
        nextCalendarEventTitle: true,
        connectionStrength: true,
      },
    });

    // A person's company is always refreshed alongside them, since the
    // company's values are a rollup of its people.
    const companyIdsInScope = new Set<string>(scope.companyIds ?? []);
    for (const person of people) {
      if (person.companyId) companyIdsInScope.add(person.companyId);
    }

    const companies: CompanyRow[] = await prisma.company.findMany({
      where: isFullRun ? undefined : { id: { in: [...companyIdsInScope] } },
      select: {
        id: true,
        domain: true,
        domains: true,
        lastEmailInteractionAt: true,
        lastCalendarInteractionAt: true,
        nextCalendarEventAt: true,
        nextCalendarEventTitle: true,
        connectionStrength: true,
      },
    });

    console.log(
      `${LOG} scanning ${people.length} people and ${companies.length} companies`
    );

    const data = await loadInteractionData(now);

    // Lookups: email to person, email domain to company. Every person is
    // resolvable to a company through companyId, so domain matching only has
    // to cover attendees we have no contact record for.
    const personIdByEmail = new Map<string, string>();
    const companyIdByPersonId = new Map<string, string>();
    for (const person of people) {
      if (person.email) personIdByEmail.set(person.email.toLowerCase(), person.id);
      if (person.companyId) companyIdByPersonId.set(person.id, person.companyId);
    }

    // People outside the scope still need to resolve to their company so a
    // scoped run does not understate the rollup.
    const allPersonEmails = isFullRun
      ? []
      : await prisma.person.findMany({
        where: { email: { not: null }, companyId: { in: [...companyIdsInScope] } },
        select: { id: true, email: true, companyId: true },
      });
    for (const person of allPersonEmails) {
      if (person.email && !personIdByEmail.has(person.email.toLowerCase())) {
        personIdByEmail.set(person.email.toLowerCase(), person.id);
      }
      if (person.companyId) companyIdByPersonId.set(person.id, person.companyId);
    }

    const companyIdByDomain = new Map<string, string>();
    for (const company of companies) {
      for (const domain of [company.domain, ...company.domains]) {
        if (domain) companyIdByDomain.set(domain.toLowerCase(), company.id);
      }
    }

    const personAccumulators = new Map<string, Accumulator>(
      people.map((person) => [person.id, emptyAccumulator()])
    );
    const companyAccumulators = new Map<string, Accumulator>(
      companies.map((company) => [company.id, emptyAccumulator()])
    );

    /** Resolves an attendee email to the person and company it belongs to. */
    const resolve = (
      email: string
    ): { personId: string | null; companyId: string | null } => {
      const normalised = email.toLowerCase().trim();
      const personId = personIdByEmail.get(normalised) ?? null;
      const domain = emailDomain(normalised);
      const companyId =
        (personId ? companyIdByPersonId.get(personId) : null) ??
        (domain ? companyIdByDomain.get(domain) ?? null : null);
      return { personId, companyId };
    };

    console.log(`${LOG} attributing past meetings...`);
    for (const meeting of data.pastMeetings) {
      // Deduped per company so a meeting linked both by clientCompanyId and by
      // an attendee only counts once towards the interaction volume.
      const companyIds = new Set<string>();
      if (meeting.clientCompanyId) companyIds.add(meeting.clientCompanyId);

      for (const attendee of meeting.participants) {
        if (isJaroDevTeamEmail(attendee)) continue;
        const { personId, companyId } = resolve(attendee);
        if (personId) {
          const acc = personAccumulators.get(personId);
          if (acc) noteMeeting(acc, meeting.startTime, windowStart);
        }
        if (companyId) companyIds.add(companyId);
      }

      for (const companyId of companyIds) {
        const acc = companyAccumulators.get(companyId);
        if (acc) noteMeeting(acc, meeting.startTime, windowStart);
      }
    }

    console.log(`${LOG} attributing upcoming calendar events...`);
    for (const event of data.upcomingEvents) {
      const companyIds = new Set<string>();

      for (const attendee of event.attendees) {
        if (isJaroDevTeamEmail(attendee)) continue;
        const { personId, companyId } = resolve(attendee);
        if (personId) {
          const acc = personAccumulators.get(personId);
          if (acc) noteUpcoming(acc, event.startTime, event.title);
        }
        if (companyId) companyIds.add(companyId);
      }

      for (const companyId of companyIds) {
        const acc = companyAccumulators.get(companyId);
        if (acc) noteUpcoming(acc, event.startTime, event.title);
      }
    }

    console.log(`${LOG} attributing email touches...`);
    for (const touch of data.emailTouches) {
      const resolved = touch.email ? resolve(touch.email) : null;
      const personId = touch.personId ?? resolved?.personId ?? null;
      const companyId =
        touch.companyId ??
        resolved?.companyId ??
        (personId ? companyIdByPersonId.get(personId) ?? null : null);

      if (personId) {
        const acc = personAccumulators.get(personId);
        if (acc) noteEmail(acc, touch.at, windowStart);
      }
      if (companyId) {
        const acc = companyAccumulators.get(companyId);
        if (acc) noteEmail(acc, touch.at, windowStart);
      }
    }

    console.log(`${LOG} writing changed rows...`);
    const peopleUpdated = await writeChanges("person", people, personAccumulators, now);
    const companiesUpdated = await writeChanges(
      "company",
      companies,
      companyAccumulators,
      now
    );

    const summary: EngagementSummary = {
      peopleScanned: people.length,
      peopleUpdated,
      companiesScanned: companies.length,
      companiesUpdated,
    };

    console.log(
      `${LOG} done: ${peopleUpdated}/${people.length} people and ${companiesUpdated}/${companies.length} companies updated`
    );

    return { data: summary, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} recompute failed:`, message);
    return { data: null, error: message };
  }
}

type EngagementRow = PersonRow | CompanyRow;

/** Writes only the rows whose computed values actually moved. */
async function writeChanges(
  model: "person" | "company",
  rows: EngagementRow[],
  accumulators: Map<string, Accumulator>,
  now: Date
): Promise<number> {
  const updates: Prisma.PrismaPromise<unknown>[] = [];

  for (const row of rows) {
    const acc = accumulators.get(row.id);
    if (!acc) continue;

    const connectionStrength = computeConnectionStrength(acc, now);

    const unchanged =
      sameDate(row.lastEmailInteractionAt, acc.lastEmailInteractionAt) &&
      sameDate(row.lastCalendarInteractionAt, acc.lastCalendarInteractionAt) &&
      sameDate(row.nextCalendarEventAt, acc.nextCalendarEventAt) &&
      row.nextCalendarEventTitle === acc.nextCalendarEventTitle &&
      row.connectionStrength === connectionStrength;

    if (unchanged) continue;

    const data = {
      lastEmailInteractionAt: acc.lastEmailInteractionAt,
      lastCalendarInteractionAt: acc.lastCalendarInteractionAt,
      nextCalendarEventAt: acc.nextCalendarEventAt,
      nextCalendarEventTitle: acc.nextCalendarEventTitle,
      connectionStrength,
      engagementComputedAt: now,
    };

    updates.push(
      model === "person"
        ? prisma.person.update({ where: { id: row.id }, data })
        : prisma.company.update({ where: { id: row.id }, data })
    );
  }

  for (let i = 0; i < updates.length; i += WRITE_CHUNK_SIZE) {
    await prisma.$transaction(updates.slice(i, i + WRITE_CHUNK_SIZE));
  }

  return updates.length;
}

// ============================================
// Public entry points
// ============================================

/** Full sweep. Used by the cron and the backfill script. */
export async function recomputeAllEngagement(): Promise<{
  data: EngagementSummary | null;
  error: string | null;
}> {
  return recomputeEngagement();
}

export async function recomputeEngagementForPeople(
  personIds: string[]
): Promise<{ data: EngagementSummary | null; error: string | null }> {
  if (personIds.length === 0) {
    return { data: null, error: null };
  }
  return recomputeEngagement({ personIds });
}

export async function recomputeEngagementForCompanies(
  companyIds: string[]
): Promise<{ data: EngagementSummary | null; error: string | null }> {
  if (companyIds.length === 0) {
    return { data: null, error: null };
  }
  return recomputeEngagement({ companyIds });
}

/**
 * Convenience for callers that only know email addresses, such as meeting
 * ingest. Unknown addresses are ignored.
 */
export async function recomputeEngagementForEmails(
  emails: string[],
  companyIds: string[] = []
): Promise<{ data: EngagementSummary | null; error: string | null }> {
  try {
    const normalised = emails
      .filter((email) => !isJaroDevTeamEmail(email))
      .map((email) => email.toLowerCase().trim())
      .filter(Boolean);

    if (normalised.length === 0 && companyIds.length === 0) {
      return { data: null, error: null };
    }

    const people = normalised.length
      ? await prisma.person.findMany({
        where: { email: { in: normalised, mode: "insensitive" } },
        select: { id: true },
      })
      : [];

    if (people.length === 0 && companyIds.length === 0) {
      console.log(`${LOG} no matching contacts for the given emails, skipping`);
      return { data: null, error: null };
    }

    return recomputeEngagement({
      personIds: people.map((person) => person.id),
      companyIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} email-scoped recompute failed:`, message);
    return { data: null, error: message };
  }
}
