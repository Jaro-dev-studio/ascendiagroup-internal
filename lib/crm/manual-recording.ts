import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { isRecallConfigured, scheduleBot } from "@/lib/integrations/recall";
import { detectMeetingUrl } from "@/lib/integrations/google-calendar";

const LOG = "[Manual Recording]";

/**
 * Marks a CalendarEvent that was created from a pasted link rather than synced
 * from Google, so calendar sync never tries to reconcile it against a rule.
 */
export const MANUAL_EVENT_PREFIX = "manual:";

const DEFAULT_BOT_NAME = "Jaro.dev Notetaker";

/** Ad-hoc meetings have no scheduled end, so assume a normal hour-long call. */
const ASSUMED_DURATION_MS = 60 * 60_000;

/** A bot already on this link within this window counts as the same meeting. */
const DEDUPE_WINDOW_MS = 4 * 60 * 60_000;

export interface StartManualRecordingInput {
  /** Anything containing a Meet, Zoom, Teams or Webex link. */
  meetingUrl: string;
  title?: string | null;
  /** Whose recorder this is, used for display and to pick the bot name. */
  calendarEmail: string;
}

export interface StartManualRecordingResult {
  calendarEventId: string;
  recallBotId: string;
  meetingUrl: string;
  platform: string;
  botName: string;
}

/**
 * Sends the notetaker into a live meeting from a pasted link, without waiting
 * for the calendar to know about it.
 *
 * The bot is created with no `join_at` so Recall dispatches it immediately, and
 * it is recorded as a CalendarEvent like any scheduled bot. That is what makes
 * the rest of the pipeline work unchanged: the webhook, the reconciliation poll
 * and the transcript ingest all find the meeting through `recallBotId`.
 */
export async function startManualRecording(
  input: StartManualRecordingInput
): Promise<{ data: StartManualRecordingResult | null; error: string | null }> {
  try {
    if (!isRecallConfigured()) {
      return { data: null, error: "RECALL_API_KEY is not configured" };
    }

    const detected = detectMeetingUrl(input.meetingUrl.trim());

    if (!detected) {
      return {
        data: null,
        error:
          "That is not a Google Meet, Zoom, Teams or Webex link the recorder can join",
      };
    }

    console.log(`${LOG} joining ${detected.platform} meeting ${detected.url}...`);

    const now = new Date();

    const existing = await prisma.calendarEvent.findFirst({
      where: {
        meetingUrl: detected.url,
        decision: { in: ["SCHEDULED", "RECORDING"] },
        recallBotId: { not: null },
        startTime: { gte: new Date(now.getTime() - DEDUPE_WINDOW_MS) },
      },
      select: { id: true },
    });

    if (existing) {
      console.log(`${LOG} a bot is already on this link, not sending another`);
      return {
        data: null,
        error: "The recorder is already joining this meeting",
      };
    }

    console.log(`${LOG} resolving the bot name to use...`);

    // The notetaker should look the same in an ad-hoc call as in a scheduled
    // one, so reuse the caller's own rule and fall back to any enabled rule.
    const ownRule = await prisma.recordingRule.findUnique({
      where: { calendarEmail: input.calendarEmail },
      select: { botName: true },
    });
    const anyRule = ownRule
      ? null
      : await prisma.recordingRule.findFirst({
        where: { enabled: true },
        select: { botName: true },
        orderBy: { calendarEmail: "asc" },
      });

    const botName = ownRule?.botName ?? anyRule?.botName ?? DEFAULT_BOT_NAME;

    const event = await prisma.calendarEvent.create({
      data: {
        googleEventId: `${MANUAL_EVENT_PREFIX}${randomUUID()}`,
        calendarEmail: input.calendarEmail,
        title: input.title?.trim() || "Ad-hoc meeting",
        startTime: now,
        endTime: new Date(now.getTime() + ASSUMED_DURATION_MS),
        organizer: input.calendarEmail,
        attendees: [],
        status: "confirmed",
        meetingUrl: detected.url,
        platform: detected.platform,
        decision: "PENDING",
        decisionReason: "Started manually from a pasted link",
      },
    });

    console.log(`${LOG} creating an ad-hoc bot for event ${event.id}...`);

    const bot = await scheduleBot({
      meetingUrl: detected.url,
      botName,
      metadata: {
        calendarEventId: event.id,
        calendarEmail: input.calendarEmail,
      },
    });

    if (!bot.data) {
      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: { decision: "FAILED", decisionReason: bot.error },
      });
      return { data: null, error: bot.error };
    }

    await prisma.calendarEvent.update({
      where: { id: event.id },
      data: {
        decision: "SCHEDULED",
        recallBotId: bot.data.id,
        botScheduledFor: now,
        botStatus: "scheduled",
      },
    });

    console.log(`${LOG} bot ${bot.data.id} is on its way to ${detected.url}`);

    return {
      data: {
        calendarEventId: event.id,
        recallBotId: bot.data.id,
        meetingUrl: detected.url,
        platform: detected.platform,
        botName,
      },
      error: null,
    };
  } catch (error) {
    console.error(`${LOG} failed to start recording:`, error);
    return { data: null, error: "Failed to start the recording" };
  }
}