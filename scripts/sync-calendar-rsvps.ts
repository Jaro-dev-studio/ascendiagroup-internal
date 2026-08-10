import prisma from "../lib/prisma";
import { syncCalendarsAndScheduleBots } from "../lib/crm/calendar-sync";
import { parseAttendeeResponses } from "../lib/integrations/google-calendar";

/**
 * Runs the calendar sync by hand and reports the RSVP each upcoming call is
 * carrying before and after, so a status that looks wrong on the dashboard can
 * be told apart from a status that is merely stale in our database.
 *
 * Every row is printed, including the duplicate a shared meeting gets on each
 * team calendar, because the dashboard collapses those and only shows one.
 *
 * Usage:
 *   pnpm crm:sync-calendars
 */

const LOG = "[Sync RSVP]";

interface EventRow {
  googleEventId: string;
  calendarEmail: string;
  title: string | null;
  startTime: Date;
  organizer: string | null;
  status: string | null;
  meetingUrl: string | null;
  attendeeResponses: unknown;
}

function describe(row: EventRow): string {
  const rsvps = parseAttendeeResponses(row.attendeeResponses);
  const answers =
    rsvps.length === 0
      ? "no RSVPs on record"
      : rsvps
        .map((rsvp) => `${rsvp.email}=${rsvp.responseStatus}`)
        .join(", ");

  return (
    `${row.startTime.toISOString()} "${row.title ?? "Meeting"}" ` +
    `[cal ${row.calendarEmail}] [status ${row.status ?? "none"}] ${answers}`
  );
}

async function loadUpcoming(): Promise<EventRow[]> {
  const from = new Date(Date.now() - 30 * 60 * 1000);

  return prisma.calendarEvent.findMany({
    where: { startTime: { gte: from }, isAllDay: false },
    orderBy: [{ startTime: "asc" }, { calendarEmail: "asc" }],
    select: {
      googleEventId: true,
      calendarEmail: true,
      title: true,
      startTime: true,
      organizer: true,
      status: true,
      meetingUrl: true,
      attendeeResponses: true,
    },
  });
}

function key(row: EventRow): string {
  return `${row.googleEventId}#${row.calendarEmail}`;
}

async function main() {
  console.log(`${LOG} reading upcoming events as they stand now...`);
  const before = await loadUpcoming();
  console.log(`${LOG} ${before.length} upcoming row(s) in the database`);
  for (const row of before) console.log(`${LOG}   ${describe(row)}`);

  console.log(`${LOG} running the calendar sync...`);
  const result = await syncCalendarsAndScheduleBots();

  if (result.error || !result.data) {
    throw new Error(result.error ?? "Calendar sync returned nothing");
  }

  const summary = result.data;
  console.log(
    `${LOG} sync done: ${summary.calendarsProcessed} calendar(s), ` +
      `${summary.eventsUpserted} event(s) written, ${summary.botsScheduled} bot(s) scheduled, ` +
      `${summary.botsRescheduled} rescheduled, ${summary.botsCancelled} cancelled, ` +
      `${summary.skipped} skipped, ${summary.duplicates} duplicate(s)`
  );

  if (summary.errors.length > 0) {
    console.warn(`${LOG} sync reported errors: ${summary.errors.join("; ")}`);
    process.exitCode = 1;
  }

  console.log(`${LOG} re-reading upcoming events...`);
  const after = await loadUpcoming();
  const beforeByKey = new Map(before.map((row) => [key(row), row]));

  let changed = 0;
  for (const row of after) {
    const previous = beforeByKey.get(key(row));
    const previousAnswers = previous ? describe(previous) : null;
    const answers = describe(row);

    if (previousAnswers !== answers) {
      changed += 1;
      console.log(`${LOG} changed:`);
      console.log(`${LOG}   was: ${previousAnswers ?? "not in the database"}`);
      console.log(`${LOG}   now: ${answers}`);
    }
  }

  console.log(
    `${LOG} ${after.length} upcoming row(s) after the sync, ${changed} changed`
  );

  const declined = after.filter((row) =>
    parseAttendeeResponses(row.attendeeResponses).some(
      (rsvp) => rsvp.responseStatus === "declined"
    )
  );

  console.log(`${LOG} ${declined.length} upcoming row(s) hold a decline:`);
  for (const row of declined) console.log(`${LOG}   ${describe(row)}`);
}

main()
  .catch((error) => {
    console.error(`${LOG} failed:`, error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
