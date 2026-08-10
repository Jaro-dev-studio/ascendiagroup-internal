import { google, type calendar_v3 } from "googleapis";
import { CALENDAR_SCOPES, getImpersonatedClient } from "@/lib/integrations/google-auth";

const LOG = "[Google Calendar]";

export type ConferencePlatform =
  | "google_meet"
  | "zoom"
  | "microsoft_teams"
  | "webex";

export type AttendeeResponseStatus =
  | "accepted"
  | "declined"
  | "tentative"
  | "needsAction";

export interface CalendarAttendeeResponse {
  email: string;
  responseStatus: AttendeeResponseStatus;
}

export interface NormalisedCalendarEvent {
  googleEventId: string;
  calendarEmail: string;
  title: string | null;
  description: string | null;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  organizer: string | null;
  attendees: string[];
  attendeeResponses: CalendarAttendeeResponse[];
  status: string | null;
  meetingUrl: string | null;
  platform: ConferencePlatform | null;
}

export interface CalendarSyncResult {
  events: NormalisedCalendarEvent[];
  /** Google event ids that were deleted or declined and should be cancelled */
  cancelledEventIds: string[];
  nextSyncToken: string | null;
  /** True when Google invalidated our token and we resynced the whole window */
  fullResync: boolean;
}

const MEETING_URL_PATTERNS: Array<{
  platform: ConferencePlatform;
  pattern: RegExp;
}> = [
  { platform: "google_meet", pattern: /https:\/\/meet\.google\.com\/[a-z0-9-]+/i },
  {
    platform: "zoom",
    pattern: /https:\/\/[a-z0-9.-]*zoom\.us\/j\/\d+(?:\?[^\s<>"]*)?/i,
  },
  {
    platform: "microsoft_teams",
    pattern: /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"]+/i,
  },
  {
    platform: "webex",
    pattern: /https:\/\/[a-z0-9.-]*webex\.com\/[^\s<>"]+/i,
  },
];

/**
 * Pulls the first supported conference link out of arbitrary text, so a link
 * pasted by hand is validated exactly like one found on a calendar event.
 */
export function detectMeetingUrl(
  text: string
): { url: string; platform: ConferencePlatform } | null {
  for (const { platform, pattern } of MEETING_URL_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return { url: match[0], platform };
    }
  }

  return null;
}

/**
 * Finds the join URL for an event, checking Google's structured conferenceData
 * first and falling back to scanning the location and description for Zoom,
 * Teams and Webex links that external organisers paste in.
 */
export function extractMeetingUrl(
  event: calendar_v3.Schema$Event
): { url: string; platform: ConferencePlatform } | null {
  if (event.hangoutLink) {
    return { url: event.hangoutLink, platform: "google_meet" };
  }

  const entryPoint = event.conferenceData?.entryPoints?.find(
    (point) => point.entryPointType === "video" && point.uri
  );
  if (entryPoint?.uri) {
    return {
      url: entryPoint.uri,
      platform: detectMeetingUrl(entryPoint.uri)?.platform ?? "google_meet",
    };
  }

  return detectMeetingUrl(
    [event.location, event.description].filter(Boolean).join("\n")
  );
}

function normaliseEvent(
  event: calendar_v3.Schema$Event,
  calendarEmail: string
): NormalisedCalendarEvent | null {
  if (!event.id) return null;

  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
  const startRaw = event.start?.dateTime ?? event.start?.date;
  const endRaw = event.end?.dateTime ?? event.end?.date;

  if (!startRaw || !endRaw) return null;

  const conference = extractMeetingUrl(event);

  const attendeeResponses: CalendarAttendeeResponse[] = (event.attendees ?? [])
    .filter((attendee): attendee is calendar_v3.Schema$EventAttendee & { email: string } =>
      Boolean(attendee.email)
    )
    .map((attendee) => ({
      email: attendee.email,
      responseStatus: normaliseResponseStatus(attendee.responseStatus),
    }));

  const attendees = attendeeResponses.map((attendee) => attendee.email);

  return {
    googleEventId: event.id,
    calendarEmail,
    title: event.summary ?? null,
    description: event.description ?? null,
    startTime: new Date(startRaw),
    endTime: new Date(endRaw),
    isAllDay,
    organizer: event.organizer?.email ?? null,
    attendees,
    attendeeResponses,
    status: event.status ?? null,
    meetingUrl: conference?.url ?? null,
    platform: conference?.platform ?? null,
  };
}

function normaliseResponseStatus(
  status: string | null | undefined
): AttendeeResponseStatus {
  if (
    status === "accepted" ||
    status === "declined" ||
    status === "tentative" ||
    status === "needsAction"
  ) {
    return status;
  }
  return "needsAction";
}

/**
 * Reads the attendeeResponses JSON column back into typed RSVPs. Anything that
 * does not match the shape we write is dropped rather than trusted, because a
 * hand-edited or older row must not reach the UI as a bogus status.
 */
export function parseAttendeeResponses(
  value: unknown
): CalendarAttendeeResponse[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const { email, responseStatus } = entry as Record<string, unknown>;
    if (typeof email !== "string" || typeof responseStatus !== "string") {
      return [];
    }
    if (
      responseStatus !== "accepted" &&
      responseStatus !== "declined" &&
      responseStatus !== "tentative" &&
      responseStatus !== "needsAction"
    ) {
      return [];
    }
    return [{ email, responseStatus }];
  });
}

/** True when the calendar owner declined, so we should not send a bot. */
function ownerDeclined(
  event: calendar_v3.Schema$Event,
  calendarEmail: string
): boolean {
  const self = (event.attendees ?? []).find(
    (attendee) =>
      attendee.self ||
      attendee.email?.toLowerCase() === calendarEmail.toLowerCase()
  );
  return self?.responseStatus === "declined";
}

interface ListEventsOptions {
  calendarEmail: string;
  syncToken?: string | null;
  /** Window used for the initial sync and for any forced full resync */
  windowStart: Date;
  windowEnd: Date;
}

/**
 * Incrementally lists a calendar's events by impersonating its owner.
 *
 * Google only accepts a sync token on its own, so when a token is present we
 * page with the token alone; a 410 means the token expired and we fall back to
 * a bounded full resync.
 */
export async function listCalendarEvents(
  options: ListEventsOptions
): Promise<{ data: CalendarSyncResult | null; error: string | null }> {
  const { calendarEmail, windowStart, windowEnd } = options;

  try {
    const auth = getImpersonatedClient(calendarEmail, CALENDAR_SCOPES);
    if (!auth) {
      return {
        data: null,
        error: `Cannot impersonate ${calendarEmail}: Google service account not configured or mailbox is outside the Workspace domain`,
      };
    }

    const calendar = google.calendar({ version: "v3", auth });

    const run = async (
      syncToken: string | null
    ): Promise<CalendarSyncResult> => {
      const events: NormalisedCalendarEvent[] = [];
      const cancelledEventIds: string[] = [];
      let pageToken: string | undefined;
      let nextSyncToken: string | null = null;

      do {
        const response: { data: calendar_v3.Schema$Events } =
          await calendar.events.list(
            syncToken
              ? { calendarId: "primary", syncToken, pageToken, maxResults: 250 }
              : {
                calendarId: "primary",
                timeMin: windowStart.toISOString(),
                timeMax: windowEnd.toISOString(),
                singleEvents: true,
                orderBy: "startTime",
                pageToken,
                maxResults: 250,
              }
          );

        for (const event of response.data.items ?? []) {
          if (!event.id) continue;

          if (event.status === "cancelled" || ownerDeclined(event, calendarEmail)) {
            cancelledEventIds.push(event.id);
            continue;
          }

          const normalised = normaliseEvent(event, calendarEmail);
          if (normalised) events.push(normalised);
        }

        pageToken = response.data.nextPageToken ?? undefined;
        nextSyncToken = response.data.nextSyncToken ?? nextSyncToken;
      } while (pageToken);

      return { events, cancelledEventIds, nextSyncToken, fullResync: !syncToken };
    };

    console.log(
      `${LOG} listing events for ${calendarEmail} (incremental=${Boolean(options.syncToken)})...`
    );

    try {
      const result = await run(options.syncToken ?? null);
      console.log(
        `${LOG} ${calendarEmail}: ${result.events.length} events, ${result.cancelledEventIds.length} cancelled`
      );
      return { data: result, error: null };
    } catch (error) {
      const status = (error as { code?: number; status?: number })?.code ??
        (error as { status?: number })?.status;

      if (options.syncToken && status === 410) {
        console.log(
          `${LOG} ${calendarEmail}: sync token expired, doing a full resync`
        );
        const result = await run(null);
        return { data: result, error: null };
      }

      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} failed to list events for ${calendarEmail}:`, message);
    return { data: null, error: message };
  }
}
