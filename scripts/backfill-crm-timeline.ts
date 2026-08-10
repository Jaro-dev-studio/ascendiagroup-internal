import prisma from "../lib/prisma";
import { logCrmActivity } from "../lib/crm/activity";
import { logScheduledMeetings } from "../lib/crm/meeting-activity";
import { syncMailboxEmails } from "../lib/crm/email-sync";
import { isJaroDevTeamEmail } from "../lib/constants";

/**
 * Fills in the timeline entries that happened before the CRM started recording
 * them, so a contact's Activity tab shows their history rather than only what
 * has occurred since:
 *
 *   - form submissions already linked to a contact
 *   - calls we recorded, against everyone who was on them
 *   - bookings on upcoming calendar events
 *   - mail exchanged with contacts, read back from the delegated mailboxes
 *
 * Safe to re-run: every entry is written under a stable external id, so a
 * second run adds nothing.
 *
 * Usage:
 *   pnpm crm:backfill-timeline [--email-days=90] [--skip-email]
 */

const LOG = "[Backfill Timeline]";

/** A recorded call and an imported one can describe the same meeting. */
const DUPLICATE_MEETING_WINDOW_MS = 60 * 60_000;

async function backfillFormSubmissions(): Promise<number> {
  console.log(`${LOG} loading form submissions linked to a contact...`);

  const submissions = await prisma.embedFormSubmission.findMany({
    where: { personId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      type: true,
      personId: true,
      companyId: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      utmTerm: true,
      utmContent: true,
    },
  });

  console.log(`${LOG} found ${submissions.length} submission(s)`);

  let logged = 0;

  for (const submission of submissions) {
    const result = await logCrmActivity({
      type: "FORM_SUBMITTED",
      title:
        submission.type === "BUSINESSOS"
          ? "Submitted the BusinessOS form"
          : "Submitted the enquiry form",
      personId: submission.personId,
      companyId: submission.companyId,
      occurredAt: submission.createdAt,
      payload: {
        submissionId: submission.id,
        utmSource: submission.utmSource,
        utmMedium: submission.utmMedium,
        utmCampaign: submission.utmCampaign,
        utmTerm: submission.utmTerm,
        utmContent: submission.utmContent,
      },
      externalId: `form-submission:${submission.id}`,
    });

    if (result.data) logged += 1;
  }

  return logged;
}

/**
 * Puts every recorded call on the timeline of the contacts who attended it.
 * Calls processed before the timeline existed only ever produced a Meeting row.
 *
 * Contacts are matched by email and never created here: an address we have no
 * contact for has no timeline to show the call on. Meetings already represented
 * for that contact at that time, including the ones imported from Attio, are
 * left alone.
 */
async function backfillPastMeetings(): Promise<{
  logged: number;
  skipped: number;
  unmatched: number;
}> {
  console.log(`${LOG} loading recorded meetings...`);

  const meetings = await prisma.meeting.findMany({
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      title: true,
      startTime: true,
      participants: true,
      summary: true,
      clientCompanyId: true,
    },
  });

  console.log(`${LOG} found ${meetings.length} meeting(s)`);

  const addresses = [
    ...new Set(
      meetings
        .flatMap((meeting) => meeting.participants)
        .filter((email) => email && !isJaroDevTeamEmail(email))
        .map((email) => email.toLowerCase().trim())
    ),
  ];

  const people = await prisma.person.findMany({
    where: { email: { in: addresses, mode: "insensitive" } },
    select: { id: true, email: true, companyId: true },
  });

  const personByEmail = new Map(
    people.flatMap((person) =>
      person.email ? [[person.email.toLowerCase(), person] as const] : []
    )
  );

  console.log(
    `${LOG} ${personByEmail.size} of ${addresses.length} external participant(s) are contacts`
  );

  let logged = 0;
  let skipped = 0;
  const unmatched = new Set<string>();

  for (const meeting of meetings) {
    for (const participant of meeting.participants) {
      if (!participant || isJaroDevTeamEmail(participant)) continue;

      const person = personByEmail.get(participant.toLowerCase().trim());
      if (!person) {
        unmatched.add(participant.toLowerCase().trim());
        continue;
      }

      const existing = await prisma.crmActivity.findFirst({
        where: {
          personId: person.id,
          type: "MEETING",
          occurredAt: {
            gte: new Date(meeting.startTime.getTime() - DUPLICATE_MEETING_WINDOW_MS),
            lte: new Date(meeting.startTime.getTime() + DUPLICATE_MEETING_WINDOW_MS),
          },
        },
        select: { id: true },
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      const result = await logCrmActivity({
        type: "MEETING",
        title: meeting.title,
        body: meeting.summary,
        personId: person.id,
        companyId: person.companyId ?? meeting.clientCompanyId,
        meetingId: meeting.id,
        occurredAt: meeting.startTime,
        externalId: `meeting:${meeting.id}:${person.id}`,
      });

      if (result.data) logged += 1;
    }
  }

  return { logged, skipped, unmatched: unmatched.size };
}

async function backfillScheduledMeetings(): Promise<number> {
  console.log(`${LOG} loading upcoming calendar events...`);

  const events = await prisma.calendarEvent.findMany({
    where: { startTime: { gte: new Date() }, isAllDay: false },
    orderBy: { startTime: "asc" },
    select: {
      startTime: true,
      title: true,
      attendees: true,
      organizer: true,
      meetingUrl: true,
      status: true,
    },
  });

  const bookings = events.filter((event) => event.status !== "cancelled");

  console.log(`${LOG} found ${bookings.length} upcoming event(s)`);

  const result = await logScheduledMeetings(
    bookings.map((event) => ({
      attendeeEmails: [...event.attendees, event.organizer].filter(
        (email): email is string => Boolean(email)
      ),
      startTime: event.startTime,
      title: event.title,
      meetingUrl: event.meetingUrl,
      source: "google-calendar",
    }))
  );

  if (result.error || !result.data) {
    throw new Error(result.error ?? "Scheduled meeting backfill returned nothing");
  }

  return result.data.logged;
}

async function main() {
  const emailDaysArg = process.argv
    .find((arg) => arg.startsWith("--email-days="))
    ?.split("=")[1];
  const skipEmail = process.argv.includes("--skip-email");
  const emailDays = Number(emailDaysArg ?? 90);

  const forms = await backfillFormSubmissions();
  const past = await backfillPastMeetings();
  const meetings = await backfillScheduledMeetings();

  let emails = 0;
  if (skipEmail) {
    console.log(`${LOG} skipping the mailbox read`);
  } else {
    console.log(`${LOG} reading the last ${emailDays} days of mail...`);
    const result = await syncMailboxEmails({
      lookbackDays: emailDays,
      maxMessagesPerMailbox: 2000,
    });
    if (result.error) throw new Error(result.error);
    emails = result.data?.activitiesLogged ?? 0;
  }

  const counts = await prisma.crmActivity.groupBy({
    by: ["type"],
    _count: true,
    orderBy: { _count: { type: "desc" } },
  });

  console.log(
    `${LOG} done: ${forms} form submission(s), ${past.logged} past meeting(s) ` +
      `(${past.skipped} already on a timeline, ${past.unmatched} participant(s) have no contact), ` +
      `${meetings} booking(s) and ${emails} email(s) recorded against a contact`
  );
  console.log(
    `${LOG} timeline totals: ${counts
      .map((row) => `${row.type}=${row._count}`)
      .join(", ")}`
  );
}

main()
  .catch((error) => {
    console.error(`${LOG} failed:`, error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
