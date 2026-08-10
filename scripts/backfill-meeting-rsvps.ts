import prisma from "../lib/prisma";
import { listCalendarEvents } from "../lib/integrations/google-calendar";
import { backfillMeetingRsvps } from "../lib/crm/meeting-activity";
import type { ScheduledMeetingInput } from "../lib/crm/meeting-activity";

/**
 * Reads the RSVP each lead ended on for meetings that already happened and puts
 * it on their timeline, covering history from before the calendar sync existed.
 *
 * Google keeps an attendee's response on past events indefinitely, so the final
 * answer is recoverable even though the moment they gave it is not. Only the
 * badge on the booking is written; see backfillMeetingRsvps for why.
 *
 * Future meetings are left alone because the sync-calendars cron owns those.
 *
 * Safe to re-run: entries are keyed on the contact and the meeting start time,
 * so a second run only touches statuses that actually changed.
 *
 * Usage:
 *   pnpm crm:backfill-rsvps [--days=90] [--dry-run]
 */

const LOG = "[Backfill RSVP]";

const DEFAULT_DAYS = 90;

async function main() {
  const daysArg = process.argv
    .find((arg) => arg.startsWith("--days="))
    ?.split("=")[1];
  const dryRun = process.argv.includes("--dry-run");
  const days = Number(daysArg ?? DEFAULT_DAYS);

  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(`--days must be a positive number, got "${daysArg}"`);
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - days * 86_400_000);

  console.log(
    `${LOG} looking back ${days} day(s) to ${windowStart.toISOString()}${
      dryRun ? " (dry run, nothing will be written)" : ""
    }`
  );

  console.log(`${LOG} loading team calendars...`);
  const rules = await prisma.recordingRule.findMany({
    orderBy: { calendarEmail: "asc" },
    select: { calendarEmail: true, enabled: true },
  });

  if (rules.length === 0) {
    console.log(`${LOG} no recording rules, so no calendars to read`);
    return;
  }

  console.log(
    `${LOG} ${rules.length} calendar(s): ${rules
      .map((rule) => `${rule.calendarEmail}${rule.enabled ? "" : " (disabled)"}`)
      .join(", ")}`
  );

  const meetings: ScheduledMeetingInput[] = [];
  const errors: string[] = [];

  for (const rule of rules) {
    console.log(`${LOG} reading past events for ${rule.calendarEmail}...`);

    // No sync token: this is a deliberate one-off read of a historical window,
    // and it must not disturb the token the cron syncs with.
    const result = await listCalendarEvents({
      calendarEmail: rule.calendarEmail,
      syncToken: null,
      windowStart,
      windowEnd: now,
    });

    if (!result.data) {
      console.error(`${LOG} ${rule.calendarEmail}: ${result.error}`);
      errors.push(`${rule.calendarEmail}: ${result.error}`);
      continue;
    }

    const past = result.data.events.filter(
      (event) =>
        !event.isAllDay &&
        event.status !== "cancelled" &&
        event.startTime.getTime() < now.getTime()
    );

    console.log(
      `${LOG} ${rule.calendarEmail}: ${past.length} past meeting(s) of ${result.data.events.length} event(s) in the window`
    );

    for (const event of past) {
      meetings.push({
        attendeeEmails: [...event.attendees, event.organizer].filter(
          (email): email is string => Boolean(email)
        ),
        startTime: event.startTime,
        title: event.title,
        meetingUrl: event.meetingUrl,
        source: "google-calendar",
        googleEventId: event.googleEventId,
        attendeeResponses: event.attendeeResponses,
      });
    }
  }

  if (meetings.length === 0) {
    console.log(`${LOG} no past meetings found in the window`);
    return;
  }

  console.log(`${LOG} applying ${meetings.length} past meeting(s) to timelines...`);
  const result = await backfillMeetingRsvps(meetings, { dryRun });

  if (result.error || !result.data) {
    throw new Error(result.error ?? "Backfill returned nothing");
  }

  const { created, updated, unchanged, unmatched } = result.data;

  console.log(
    `${LOG} done: ${created} booking(s) added, ${updated} updated, ${unchanged} already correct, ` +
      `${unmatched} external address(es) have no contact to show them on`
  );

  if (errors.length > 0) {
    console.warn(`${LOG} ${errors.length} calendar(s) failed: ${errors.join("; ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(`${LOG} failed:`, error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
