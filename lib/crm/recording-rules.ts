import { isJaroDevTeamEmail } from "@/lib/constants";
import type { RecordingRule } from "@prisma/client";
import type { NormalisedCalendarEvent } from "@/lib/integrations/google-calendar";

export interface RuleDecision {
  shouldRecord: boolean;
  reason: string;
}

/**
 * Decides whether a calendar event should get a bot, based on the owner's
 * recording rule. This is the "whose meetings to join" surface: every skip
 * returns a human-readable reason that is stored on the CalendarEvent so the
 * UI can explain why nothing was recorded.
 */
export function evaluateRecordingRule(
  event: NormalisedCalendarEvent,
  rule: RecordingRule
): RuleDecision {
  if (!rule.enabled) {
    return { shouldRecord: false, reason: "Recording is disabled for this calendar" };
  }

  if (!event.meetingUrl) {
    return { shouldRecord: false, reason: "No conference link on the event" };
  }

  if (event.isAllDay && rule.skipAllDayEvents) {
    return { shouldRecord: false, reason: "All-day event" };
  }

  if (event.status === "tentative") {
    return { shouldRecord: false, reason: "Event is only tentative" };
  }

  if (rule.onlyIfOrganizer) {
    const isOrganiser =
      event.organizer?.toLowerCase() === rule.calendarEmail.toLowerCase();
    if (!isOrganiser) {
      return {
        shouldRecord: false,
        reason: `${rule.calendarEmail} is not the organiser`,
      };
    }
  }

  // The calendar owner is not always listed as an attendee on events they
  // created, so count them in explicitly before checking the minimum.
  const attendeeSet = new Set(
    event.attendees.map((email) => email.toLowerCase())
  );
  attendeeSet.add(rule.calendarEmail.toLowerCase());
  const attendeeCount = attendeeSet.size;

  if (attendeeCount < rule.minAttendees) {
    return {
      shouldRecord: false,
      reason: `Only ${attendeeCount} attendee(s), minimum is ${rule.minAttendees}`,
    };
  }

  if (rule.requireExternalAttendee) {
    const hasExternal = Array.from(attendeeSet).some(
      (email) => !isJaroDevTeamEmail(email)
    );
    if (!hasExternal) {
      return { shouldRecord: false, reason: "Internal-only meeting" };
    }
  }

  const title = (event.title ?? "").toLowerCase();

  if (rule.titleExcludes.length > 0) {
    const excluded = rule.titleExcludes.find((pattern) =>
      title.includes(pattern.toLowerCase())
    );
    if (excluded) {
      return {
        shouldRecord: false,
        reason: `Title matches exclude pattern "${excluded}"`,
      };
    }
  }

  if (rule.titleIncludes.length > 0) {
    const included = rule.titleIncludes.some((pattern) =>
      title.includes(pattern.toLowerCase())
    );
    if (!included) {
      return {
        shouldRecord: false,
        reason: "Title does not match any include pattern",
      };
    }
  }

  return { shouldRecord: true, reason: "Matched recording rule" };
}

/** When the bot should join, given the rule's lead time. */
export function computeJoinAt(startTime: Date, rule: RecordingRule): Date {
  return new Date(startTime.getTime() - rule.joinMinutesBefore * 60_000);
}

/**
 * Key used to collapse the same meeting seen on multiple calendars into a
 * single bot: same join URL starting within a few minutes of each other.
 */
export function getDedupeKey(meetingUrl: string, startTime: Date): string {
  const bucket = Math.floor(startTime.getTime() / (5 * 60_000));
  return `${meetingUrl.trim().toLowerCase()}#${bucket}`;
}
