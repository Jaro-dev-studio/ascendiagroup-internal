import prisma from "@/lib/prisma";
import {
  listCalendarEvents,
  parseAttendeeResponses,
  type NormalisedCalendarEvent,
} from "@/lib/integrations/google-calendar";
import {
  cancelBot,
  isRecallConfigured,
  rescheduleBot,
  scheduleBot,
  SCHEDULED_BOT_LEAD_MINUTES,
} from "@/lib/integrations/recall";
import {
  computeJoinAt,
  evaluateRecordingRule,
  getDedupeKey,
} from "@/lib/crm/recording-rules";
import { MANUAL_EVENT_PREFIX } from "@/lib/crm/manual-recording";
import { logScheduledMeetings, syncMeetingRsvps } from "@/lib/crm/meeting-activity";
import type { CalendarEvent, Prisma, RecordingRule } from "@prisma/client";

const LOG = "[Calendar Sync]";

/** How far ahead we look on a full sync, and how far ahead we schedule bots. */
const LOOKAHEAD_DAYS = 14;
const LOOKBACK_DAYS = 1;

export interface CalendarSyncSummary {
  calendarsProcessed: number;
  eventsUpserted: number;
  botsScheduled: number;
  botsRescheduled: number;
  botsCancelled: number;
  skipped: number;
  duplicates: number;
  errors: string[];
}

/** Decisions that mean a bot exists (or existed) for the event. */
const ACTIVE_DECISIONS = ["SCHEDULED", "RECORDING"] as const;

function toWindow(now: Date): { windowStart: Date; windowEnd: Date } {
  return {
    windowStart: new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000),
    windowEnd: new Date(now.getTime() + LOOKAHEAD_DAYS * 86_400_000),
  };
}

async function upsertEvent(
  event: NormalisedCalendarEvent,
  rule: RecordingRule
): Promise<CalendarEvent> {
  return prisma.calendarEvent.upsert({
    where: {
      googleEventId_calendarEmail: {
        googleEventId: event.googleEventId,
        calendarEmail: event.calendarEmail,
      },
    },
    update: {
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      isAllDay: event.isAllDay,
      organizer: event.organizer,
      attendees: event.attendees,
      attendeeResponses:
        event.attendeeResponses as unknown as Prisma.InputJsonValue,
      status: event.status,
      meetingUrl: event.meetingUrl,
      platform: event.platform,
      ruleId: rule.id,
    },
    create: {
      googleEventId: event.googleEventId,
      calendarEmail: event.calendarEmail,
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      isAllDay: event.isAllDay,
      organizer: event.organizer,
      attendees: event.attendees,
      attendeeResponses:
        event.attendeeResponses as unknown as Prisma.InputJsonValue,
      status: event.status,
      meetingUrl: event.meetingUrl,
      platform: event.platform,
      ruleId: rule.id,
    },
  });
}

/**
 * Records upcoming bookings on the timeline of the contacts invited to them,
 * then syncs each lead's Google RSVP onto those entries (and logs accept/decline
 * activity when the status changes).
 */
async function recordBookingsOnTimeline(
  events: CalendarEvent[],
  now: Date
): Promise<void> {
  const bookings = events.filter(
    (event) =>
      event.status !== "cancelled" &&
      !event.isAllDay &&
      event.startTime.getTime() >= now.getTime()
  );

  if (bookings.length === 0) return;

  console.log(
    `${LOG} recording ${bookings.length} upcoming booking(s) on contact timelines...`
  );

  const inputs = bookings.map((event) => ({
    attendeeEmails: [...event.attendees, event.organizer].filter(
      (email): email is string => Boolean(email)
    ),
    startTime: event.startTime,
    title: event.title,
    meetingUrl: event.meetingUrl,
    source: "google-calendar",
    googleEventId: event.googleEventId,
    attendeeResponses: parseAttendeeResponses(event.attendeeResponses),
  }));

  // The booking has to be on the timeline before an RSVP can be attached to it.
  await logScheduledMeetings(inputs);

  console.log(`${LOG} syncing lead RSVP status for upcoming bookings...`);
  await syncMeetingRsvps(inputs);
}

/**
 * Cancels the bot for an event that was deleted, declined, or no longer matches
 * its rule. Safe to call when no bot was ever scheduled.
 */
async function cancelEventBot(
  event: Pick<CalendarEvent, "id" | "recallBotId" | "decision">,
  reason: string,
  summary: CalendarSyncSummary
): Promise<void> {
  if (event.recallBotId) {
    const result = await cancelBot(event.recallBotId);
    if (result.error) {
      summary.errors.push(`Cancel bot ${event.recallBotId}: ${result.error}`);
    } else {
      summary.botsCancelled += 1;
    }
  }

  await prisma.calendarEvent.update({
    where: { id: event.id },
    data: {
      decision: "CANCELLED",
      decisionReason: reason,
      recallBotId: null,
      botScheduledFor: null,
    },
  });
}

/**
 * Syncs every enabled calendar, then schedules, reschedules or cancels Recall
 * bots so the set of scheduled bots matches what the calendars now say.
 *
 * Deduplicated so a meeting both Jaro and Shubh attend gets one bot, not two.
 */
export async function syncCalendarsAndScheduleBots(): Promise<{
  data: CalendarSyncSummary | null;
  error: string | null;
}> {
  const summary: CalendarSyncSummary = {
    calendarsProcessed: 0,
    eventsUpserted: 0,
    botsScheduled: 0,
    botsRescheduled: 0,
    botsCancelled: 0,
    skipped: 0,
    duplicates: 0,
    errors: [],
  };

  try {
    console.log(`${LOG} loading enabled recording rules...`);
    const rules = await prisma.recordingRule.findMany({
      where: { enabled: true },
      orderBy: { calendarEmail: "asc" },
    });

    if (rules.length === 0) {
      console.log(`${LOG} no enabled recording rules, nothing to do`);
      return { data: summary, error: null };
    }

    const now = new Date();
    const { windowStart, windowEnd } = toWindow(now);

    // Every event we saw this run, so bookings reach the CRM timeline even when
    // Recall is not configured and pass 2 below is skipped.
    const syncedEvents: CalendarEvent[] = [];

    // Pass 1: pull each calendar and persist the events
    for (const rule of rules) {
      console.log(`${LOG} syncing ${rule.calendarEmail}...`);

      const syncState = await prisma.calendarSyncState.findUnique({
        where: { calendarEmail: rule.calendarEmail },
      });

      const result = await listCalendarEvents({
        calendarEmail: rule.calendarEmail,
        syncToken: syncState?.syncToken ?? null,
        windowStart,
        windowEnd,
      });

      if (!result.data) {
        summary.errors.push(`${rule.calendarEmail}: ${result.error}`);
        await prisma.calendarSyncState.upsert({
          where: { calendarEmail: rule.calendarEmail },
          update: { lastError: result.error, lastSyncedAt: now },
          create: {
            calendarEmail: rule.calendarEmail,
            lastError: result.error,
            lastSyncedAt: now,
          },
        });
        continue;
      }

      for (const event of result.data.events) {
        syncedEvents.push(await upsertEvent(event, rule));
        summary.eventsUpserted += 1;
      }

      // Deleted or declined events lose their bot
      for (const googleEventId of result.data.cancelledEventIds) {
        const existing = await prisma.calendarEvent.findUnique({
          where: {
            googleEventId_calendarEmail: {
              googleEventId,
              calendarEmail: rule.calendarEmail,
            },
          },
          select: { id: true, recallBotId: true, decision: true },
        });

        if (existing) {
          await cancelEventBot(
            existing,
            "Event was cancelled or declined",
            summary
          );
        }
      }

      await prisma.calendarSyncState.upsert({
        where: { calendarEmail: rule.calendarEmail },
        update: {
          syncToken: result.data.nextSyncToken,
          lastSyncedAt: now,
          lastError: null,
        },
        create: {
          calendarEmail: rule.calendarEmail,
          syncToken: result.data.nextSyncToken,
          lastSyncedAt: now,
        },
      });

      summary.calendarsProcessed += 1;
    }

    await recordBookingsOnTimeline(syncedEvents, now);

    if (!isRecallConfigured()) {
      console.warn(
        `${LOG} RECALL_API_KEY not configured; events were synced but no bots were scheduled`
      );
      return { data: summary, error: null };
    }

    // Pass 2: reconcile bots for everything still ahead of us
    console.log(`${LOG} reconciling bots for upcoming events...`);

    const upcoming = await prisma.calendarEvent.findMany({
      where: {
        startTime: { gte: now, lte: windowEnd },
        decision: { notIn: ["COMPLETED", "FAILED"] },
        // Manually started recordings have no rule to reconcile against, and
        // their bot is already in the call.
        googleEventId: { not: { startsWith: MANUAL_EVENT_PREFIX } },
      },
      orderBy: { startTime: "asc" },
      include: { rule: true },
    });

    // Earliest event per dedupe key wins the bot; the rest are marked DUPLICATE
    const claimedByKey = new Map<string, string>();

    for (const event of upcoming) {
      const rule = event.rule;

      if (!rule) {
        summary.skipped += 1;
        await prisma.calendarEvent.update({
          where: { id: event.id },
          data: {
            decision: "SKIPPED",
            decisionReason: "No recording rule for this calendar",
          },
        });
        continue;
      }

      const decision = evaluateRecordingRule(
        {
          googleEventId: event.googleEventId,
          calendarEmail: event.calendarEmail,
          title: event.title,
          description: event.description,
          startTime: event.startTime,
          endTime: event.endTime,
          isAllDay: event.isAllDay,
          organizer: event.organizer,
          attendees: event.attendees,
          attendeeResponses: parseAttendeeResponses(event.attendeeResponses),
          status: event.status,
          meetingUrl: event.meetingUrl,
          platform: null,
        },
        rule
      );

      if (!decision.shouldRecord) {
        summary.skipped += 1;
        if (event.recallBotId) {
          await cancelEventBot(event, decision.reason, summary);
        } else if (
          event.decision !== "SKIPPED" ||
          event.decisionReason !== decision.reason
        ) {
          await prisma.calendarEvent.update({
            where: { id: event.id },
            data: { decision: "SKIPPED", decisionReason: decision.reason },
          });
        }
        continue;
      }

      const dedupeKey = getDedupeKey(event.meetingUrl!, event.startTime);
      const claimant = claimedByKey.get(dedupeKey);

      if (claimant && claimant !== event.id) {
        summary.duplicates += 1;
        if (event.recallBotId) {
          await cancelEventBot(
            event,
            "Another calendar already has a bot for this meeting",
            summary
          );
        } else if (event.decision !== "DUPLICATE") {
          await prisma.calendarEvent.update({
            where: { id: event.id },
            data: {
              decision: "DUPLICATE",
              decisionReason:
                "Another calendar already has a bot for this meeting",
            },
          });
        }
        continue;
      }

      claimedByKey.set(dedupeKey, event.id);

      const joinAt = computeJoinAt(event.startTime, rule);
      const leadMs = joinAt.getTime() - now.getTime();

      // Recall only guarantees scheduled bots created 10+ minutes ahead. Inside
      // that window we still create the bot, but it becomes an ad-hoc join.
      if (leadMs < SCHEDULED_BOT_LEAD_MINUTES * 60_000) {
        console.log(
          `${LOG} "${event.title}" starts in ${Math.round(leadMs / 60_000)}min, creating an ad-hoc bot`
        );
      }

      if (
        event.recallBotId &&
        (ACTIVE_DECISIONS as readonly string[]).includes(event.decision)
      ) {
        const moved =
          !event.botScheduledFor ||
          Math.abs(event.botScheduledFor.getTime() - joinAt.getTime()) > 60_000;

        if (!moved) continue;

        console.log(`${LOG} "${event.title}" moved, rescheduling bot...`);
        const result = await rescheduleBot(event.recallBotId, joinAt);

        if (result.error) {
          summary.errors.push(
            `Reschedule ${event.recallBotId}: ${result.error}`
          );
          continue;
        }

        await prisma.calendarEvent.update({
          where: { id: event.id },
          data: { botScheduledFor: joinAt, decisionReason: decision.reason },
        });
        summary.botsRescheduled += 1;
        continue;
      }

      const result = await scheduleBot({
        meetingUrl: event.meetingUrl!,
        joinAt: leadMs > 0 ? joinAt : new Date(now.getTime() + 30_000),
        botName: rule.botName,
        metadata: {
          calendarEventId: event.id,
          calendarEmail: event.calendarEmail,
        },
      });

      if (!result.data) {
        summary.errors.push(`Schedule "${event.title}": ${result.error}`);
        await prisma.calendarEvent.update({
          where: { id: event.id },
          data: { decision: "FAILED", decisionReason: result.error },
        });
        continue;
      }

      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: {
          decision: "SCHEDULED",
          decisionReason: decision.reason,
          recallBotId: result.data.id,
          botScheduledFor: joinAt,
          botStatus: "scheduled",
        },
      });
      summary.botsScheduled += 1;
    }

    console.log(
      `${LOG} done: ${summary.calendarsProcessed} calendars, ${summary.eventsUpserted} events, ` +
        `${summary.botsScheduled} scheduled, ${summary.botsRescheduled} rescheduled, ` +
        `${summary.botsCancelled} cancelled, ${summary.skipped} skipped, ${summary.duplicates} duplicates`
    );

    return { data: summary, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} sync failed:`, message);
    return { data: null, error: message };
  }
}
