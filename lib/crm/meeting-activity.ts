import prisma from "@/lib/prisma";
import { logCrmActivity } from "@/lib/crm/activity";
import { isJaroDevTeamEmail } from "@/lib/constants";
import type {
  AttendeeResponseStatus,
  CalendarAttendeeResponse,
} from "@/lib/integrations/google-calendar";
import type { Prisma } from "@prisma/client";

const LOG = "[Meeting Activity]";

export interface ScheduledMeetingInput {
  /** Everyone on the invite. Internal addresses are filtered out here. */
  attendeeEmails: string[];
  startTime: Date;
  title: string | null;
  meetingUrl?: string | null;
  /** Where the booking came from, e.g. "google-calendar" or "calendly". */
  source: string;
  googleEventId?: string | null;
  attendeeResponses?: CalendarAttendeeResponse[];
  /**
   * When set, applied to every matched contact (e.g. Calendly invitee.created
   * means the lead already accepted by booking).
   */
  defaultLeadResponseStatus?: AttendeeResponseStatus;
}

interface MeetingPayload {
  source: string;
  meetingUrl: string | null;
  googleEventId: string | null;
  leadResponseStatus: AttendeeResponseStatus | null;
}

function externalAttendees(emails: (string | null)[]): string[] {
  const seen = new Set<string>();

  for (const email of emails) {
    if (!email || isJaroDevTeamEmail(email)) continue;
    const normalised = email.toLowerCase().trim();
    if (normalised) seen.add(normalised);
  }

  return [...seen];
}

function responseByEmail(
  responses: CalendarAttendeeResponse[] | undefined
): Map<string, AttendeeResponseStatus> {
  const map = new Map<string, AttendeeResponseStatus>();
  for (const response of responses ?? []) {
    if (!response.email) continue;
    map.set(response.email.toLowerCase().trim(), response.responseStatus);
  }
  return map;
}

function scheduledExternalId(personId: string, startTime: Date): string {
  return `meeting-scheduled:${personId}:${startTime.getTime()}`;
}

function rsvpExternalId(
  personId: string,
  startTime: Date,
  status: "accepted" | "declined"
): string {
  return `meeting-${status}:${personId}:${startTime.getTime()}`;
}

function readPayload(value: Prisma.JsonValue | null): MeetingPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = "source" in value && typeof value.source === "string"
    ? value.source
    : "";
  const meetingUrl =
    "meetingUrl" in value && typeof value.meetingUrl === "string"
      ? value.meetingUrl
      : null;
  const googleEventId =
    "googleEventId" in value && typeof value.googleEventId === "string"
      ? value.googleEventId
      : null;
  const leadResponseStatus =
    "leadResponseStatus" in value &&
    (value.leadResponseStatus === "accepted" ||
      value.leadResponseStatus === "declined" ||
      value.leadResponseStatus === "tentative" ||
      value.leadResponseStatus === "needsAction")
      ? value.leadResponseStatus
      : null;

  return { source, meetingUrl, googleEventId, leadResponseStatus };
}

/**
 * Puts a "Meeting scheduled" entry on the timeline of every known contact on
 * the invite, so a booking shows up the moment it is made rather than only
 * once the call has been recorded.
 *
 * The external id is keyed on the contact and the exact start time, so the same
 * booking reaching us twice — once from the Calendly webhook and again from the
 * calendar sync, or from two team calendars — writes a single entry. Contacts
 * we have never seen are skipped; the meeting ingest creates them later.
 */
export async function logScheduledMeetings(
  meetings: ScheduledMeetingInput[]
): Promise<{ data: { logged: number } | null; error: string | null }> {
  try {
    if (meetings.length === 0) {
      return { data: { logged: 0 }, error: null };
    }

    const emails = externalAttendees(
      meetings.flatMap((meeting) => meeting.attendeeEmails)
    );

    if (emails.length === 0) {
      return { data: { logged: 0 }, error: null };
    }

    console.log(
      `${LOG} resolving ${emails.length} attendee address(es) across ${meetings.length} meeting(s)...`
    );

    const people = await prisma.person.findMany({
      where: { email: { in: emails, mode: "insensitive" } },
      select: { id: true, email: true, companyId: true },
    });

    if (people.length === 0) {
      console.log(`${LOG} no attendee matched a contact, nothing to log`);
      return { data: { logged: 0 }, error: null };
    }

    const personByEmail = new Map(
      people.flatMap((person) =>
        person.email ? [[person.email.toLowerCase(), person] as const] : []
      )
    );

    let logged = 0;

    for (const meeting of meetings) {
      for (const email of externalAttendees(meeting.attendeeEmails)) {
        const person = personByEmail.get(email);
        if (!person) continue;

        const result = await logCrmActivity({
          type: "MEETING_SCHEDULED",
          title: meeting.title?.trim() || "Meeting",
          personId: person.id,
          companyId: person.companyId,
          occurredAt: meeting.startTime,
          payload: {
            source: meeting.source,
            meetingUrl: meeting.meetingUrl ?? null,
            googleEventId: meeting.googleEventId ?? null,
            // syncMeetingRsvps owns this field: leaving it unknown here is what
            // lets the first RSVP we see register as a change worth logging.
            leadResponseStatus: null,
          },
          externalId: scheduledExternalId(person.id, meeting.startTime),
          // The same booking reaches us from Calendly and from the calendar
          // sync, so a later title edit is worth keeping.
          updateOnConflict: { title: true },
        });

        if (result.data) logged += 1;
      }
    }

    console.log(
      `${LOG} ${logged} booking(s) on contact timelines (entries already present are left as they are)`
    );

    return { data: { logged }, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} failed to log scheduled meetings:`, message);
    return { data: null, error: message };
  }
}

/**
 * Writes the RSVP a lead ended on for meetings that have already happened, so
 * history predating the calendar sync shows the answer they gave.
 *
 * Unlike syncMeetingRsvps this only moves the badge on the booking: Google
 * reports the current status with no record of when it was set, so a dedicated
 * "Accepted" entry could only be dated to a guess. The booking entry itself is
 * created when missing, because a meeting from before the sync existed has
 * nothing to attach the badge to.
 */
export async function backfillMeetingRsvps(
  meetings: ScheduledMeetingInput[],
  options: { dryRun?: boolean } = {}
): Promise<{
  data: { created: number; updated: number; unchanged: number; unmatched: number } | null;
  error: string | null;
}> {
  try {
    const counts = { created: 0, updated: 0, unchanged: 0, unmatched: 0 };

    if (meetings.length === 0) {
      return { data: counts, error: null };
    }

    const emails = externalAttendees(
      meetings.flatMap((meeting) => meeting.attendeeEmails)
    );

    if (emails.length === 0) {
      return { data: counts, error: null };
    }

    console.log(
      `${LOG} backfilling RSVP for ${emails.length} attendee address(es) across ${meetings.length} past meeting(s)...`
    );

    const people = await prisma.person.findMany({
      where: { email: { in: emails, mode: "insensitive" } },
      select: { id: true, email: true, companyId: true },
    });

    const personByEmail = new Map(
      people.flatMap((person) =>
        person.email ? [[person.email.toLowerCase(), person] as const] : []
      )
    );

    const unmatched = new Set<string>();

    for (const meeting of meetings) {
      const responses = responseByEmail(meeting.attendeeResponses);

      for (const email of externalAttendees(meeting.attendeeEmails)) {
        const person = personByEmail.get(email);
        if (!person) {
          unmatched.add(email);
          continue;
        }

        const status =
          responses.get(email) ?? meeting.defaultLeadResponseStatus ?? null;
        if (!status) continue;

        const externalId = scheduledExternalId(person.id, meeting.startTime);
        const existing = await prisma.crmActivity.findUnique({
          where: { externalId },
          select: { payload: true },
        });

        const previous = readPayload(existing?.payload ?? null);

        if (existing && previous?.leadResponseStatus === status) {
          counts.unchanged += 1;
          continue;
        }

        if (options.dryRun) {
          console.log(
            `${LOG} would set ${email} to ${status} for ${externalId}` +
              `${existing ? "" : " (creating the booking entry)"}`
          );
          if (existing) counts.updated += 1;
          else counts.created += 1;
          continue;
        }

        const result = await logCrmActivity({
          type: "MEETING_SCHEDULED",
          title: meeting.title?.trim() || "Meeting",
          personId: person.id,
          companyId: person.companyId,
          occurredAt: meeting.startTime,
          payload: {
            source: previous?.source || meeting.source,
            meetingUrl: meeting.meetingUrl ?? previous?.meetingUrl ?? null,
            googleEventId:
              meeting.googleEventId ?? previous?.googleEventId ?? null,
            leadResponseStatus: status,
          },
          externalId,
          updateOnConflict: { payload: true },
        });

        if (!result.data) continue;
        if (existing) counts.updated += 1;
        else counts.created += 1;
      }
    }

    counts.unmatched = unmatched.size;

    console.log(
      `${LOG} backfill wrote ${counts.created} new booking(s) and updated ${counts.updated}; ` +
        `${counts.unchanged} already correct, ${counts.unmatched} address(es) have no contact`
    );

    return { data: counts, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} failed to backfill meeting RSVPs:`, message);
    return { data: null, error: message };
  }
}

/**
 * Compares each lead's current Google RSVP to what we last stored on their
 * "Meeting scheduled" entry. When it flips to accepted or declined, appends a
 * dedicated timeline event so the change is visible in activity history.
 */
export async function syncMeetingRsvps(
  meetings: ScheduledMeetingInput[]
): Promise<{ data: { logged: number } | null; error: string | null }> {
  try {
    if (meetings.length === 0) {
      return { data: { logged: 0 }, error: null };
    }

    const emails = externalAttendees(
      meetings.flatMap((meeting) => meeting.attendeeEmails)
    );

    if (emails.length === 0) {
      return { data: { logged: 0 }, error: null };
    }

    console.log(
      `${LOG} syncing RSVP for ${emails.length} attendee address(es) across ${meetings.length} meeting(s)...`
    );

    const people = await prisma.person.findMany({
      where: { email: { in: emails, mode: "insensitive" } },
      select: { id: true, email: true, companyId: true },
    });

    if (people.length === 0) {
      return { data: { logged: 0 }, error: null };
    }

    const personByEmail = new Map(
      people.flatMap((person) =>
        person.email ? [[person.email.toLowerCase(), person] as const] : []
      )
    );

    let logged = 0;

    for (const meeting of meetings) {
      const responses = responseByEmail(meeting.attendeeResponses);

      for (const email of externalAttendees(meeting.attendeeEmails)) {
        const person = personByEmail.get(email);
        if (!person) continue;

        const nextStatus =
          responses.get(email) ?? meeting.defaultLeadResponseStatus ?? null;
        if (!nextStatus) continue;

        const externalId = scheduledExternalId(person.id, meeting.startTime);
        const existing = await prisma.crmActivity.findUnique({
          where: { externalId },
          select: { payload: true },
        });

        // No scheduled entry means the contact was not on the invite we logged,
        // so there is nothing to attach an RSVP to.
        if (!existing) continue;

        const previous = readPayload(existing.payload);
        const previousStatus = previous?.leadResponseStatus ?? null;

        if (previousStatus === nextStatus) continue;

        console.log(
          `${LOG} ${email} RSVP ${previousStatus ?? "unknown"} -> ${nextStatus} for ${externalId}`
        );

        await logCrmActivity({
          type: "MEETING_SCHEDULED",
          title: meeting.title?.trim() || "Meeting",
          personId: person.id,
          companyId: person.companyId,
          occurredAt: meeting.startTime,
          payload: {
            source: previous?.source || meeting.source,
            meetingUrl: meeting.meetingUrl ?? previous?.meetingUrl ?? null,
            googleEventId:
              meeting.googleEventId ?? previous?.googleEventId ?? null,
            leadResponseStatus: nextStatus,
          },
          externalId,
          updateOnConflict: { payload: true },
        });

        // Only an explicit yes or no is worth its own timeline entry; pending
        // and tentative just move the badge on the booking.
        if (nextStatus !== "accepted" && nextStatus !== "declined") continue;

        const result = await logCrmActivity({
          type:
            nextStatus === "accepted" ? "MEETING_ACCEPTED" : "MEETING_DECLINED",
          title: `${nextStatus === "accepted" ? "Accepted" : "Declined"}: ${
            meeting.title?.trim() || "Meeting"
          }`,
          personId: person.id,
          companyId: person.companyId,
          occurredAt: new Date(),
          payload: {
            source: meeting.source,
            meetingUrl: meeting.meetingUrl ?? null,
            googleEventId: meeting.googleEventId ?? null,
            leadResponseStatus: nextStatus,
            meetingStartTime: meeting.startTime.toISOString(),
            previousLeadResponseStatus: previousStatus,
          },
          externalId: rsvpExternalId(person.id, meeting.startTime, nextStatus),
        });

        if (result.data) logged += 1;
      }
    }

    console.log(`${LOG} ${logged} RSVP change(s) written to timelines`);
    return { data: { logged }, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} failed to sync meeting RSVPs:`, message);
    return { data: null, error: message };
  }
}
