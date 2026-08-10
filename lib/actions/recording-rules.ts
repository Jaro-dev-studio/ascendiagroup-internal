"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth-helpers";
import {
  CALENDAR_SCOPES,
  isWorkspaceMailbox,
  verifyDelegation,
} from "@/lib/integrations/google-auth";
import { syncCalendarsAndScheduleBots } from "@/lib/crm/calendar-sync";
import { pollPendingRecordings } from "@/lib/crm/recorder-poll";
import {
  startManualRecording,
  type StartManualRecordingResult,
} from "@/lib/crm/manual-recording";
import { cancelBot, stopBot } from "@/lib/integrations/recall";
import type { CalendarSyncSummary } from "@/lib/crm/calendar-sync";
import type { RecorderPollSummary } from "@/lib/crm/recorder-poll";

const RULES_PATH = "/dashboard/crm/recording-rules";

export interface RecordingRuleInput {
  calendarEmail: string;
  userId?: string | null;
  enabled: boolean;
  requireExternalAttendee: boolean;
  minAttendees: number;
  titleIncludes: string[];
  titleExcludes: string[];
  skipAllDayEvents: boolean;
  onlyIfOrganizer: boolean;
  botName: string;
  joinMinutesBefore: number;
}

function sanitise(input: RecordingRuleInput) {
  return {
    userId: input.userId || null,
    enabled: input.enabled,
    requireExternalAttendee: input.requireExternalAttendee,
    minAttendees: Math.max(1, Math.min(50, Math.round(input.minAttendees))),
    titleIncludes: input.titleIncludes.map((v) => v.trim()).filter(Boolean),
    titleExcludes: input.titleExcludes.map((v) => v.trim()).filter(Boolean),
    skipAllDayEvents: input.skipAllDayEvents,
    onlyIfOrganizer: input.onlyIfOrganizer,
    botName: input.botName.trim() || "Jaro.dev Notetaker",
    joinMinutesBefore: Math.max(
      0,
      Math.min(30, Math.round(input.joinMinutesBefore))
    ),
  };
}

export async function createRecordingRule(
  input: RecordingRuleInput
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { data: null, error: "Unauthorized" };

    const calendarEmail = input.calendarEmail.toLowerCase().trim();

    if (!isWorkspaceMailbox(calendarEmail)) {
      return {
        data: null,
        error:
          "Only Workspace mailboxes can be recorded; domain-wide delegation cannot read outside calendars",
      };
    }

    console.log(`[Recording Rules] creating rule for ${calendarEmail}...`);

    const existing = await prisma.recordingRule.findUnique({
      where: { calendarEmail },
      select: { id: true },
    });
    if (existing) {
      return { data: null, error: "A rule already exists for this calendar" };
    }

    const rule = await prisma.recordingRule.create({
      data: { calendarEmail, ...sanitise(input) },
      select: { id: true },
    });

    revalidatePath(RULES_PATH);
    return { data: rule, error: null };
  } catch (error) {
    console.error("[Recording Rules] failed to create rule:", error);
    return { data: null, error: "Failed to create recording rule" };
  }
}

export async function updateRecordingRule(
  id: string,
  input: RecordingRuleInput
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { data: null, error: "Unauthorized" };

    console.log(`[Recording Rules] updating rule ${id}...`);

    const rule = await prisma.recordingRule.update({
      where: { id },
      data: sanitise(input),
      select: { id: true },
    });

    revalidatePath(RULES_PATH);
    return { data: rule, error: null };
  } catch (error) {
    console.error("[Recording Rules] failed to update rule:", error);
    return { data: null, error: "Failed to update recording rule" };
  }
}

export async function toggleRecordingRule(
  id: string,
  enabled: boolean
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { data: null, error: "Unauthorized" };

    const rule = await prisma.recordingRule.update({
      where: { id },
      data: { enabled },
      select: { id: true },
    });

    revalidatePath(RULES_PATH);
    return { data: rule, error: null };
  } catch (error) {
    console.error("[Recording Rules] failed to toggle rule:", error);
    return { data: null, error: "Failed to update recording rule" };
  }
}

/**
 * Deletes a rule and cancels any bots it had scheduled, so turning a calendar
 * off never leaves an orphaned bot that shows up in someone's meeting.
 */
export async function deleteRecordingRule(
  id: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { data: null, error: "Unauthorized" };

    console.log(`[Recording Rules] deleting rule ${id} and cancelling bots...`);

    const scheduled = await prisma.calendarEvent.findMany({
      where: {
        ruleId: id,
        decision: "SCHEDULED",
        startTime: { gte: new Date() },
        recallBotId: { not: null },
      },
      select: { id: true, recallBotId: true },
    });

    for (const event of scheduled) {
      if (!event.recallBotId) continue;
      await cancelBot(event.recallBotId);
      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: {
          decision: "CANCELLED",
          decisionReason: "Recording rule was removed",
          recallBotId: null,
          botScheduledFor: null,
        },
      });
    }

    await prisma.recordingRule.delete({ where: { id } });

    revalidatePath(RULES_PATH);
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Recording Rules] failed to delete rule:", error);
    return { data: null, error: "Failed to delete recording rule" };
  }
}

/** Confirms delegation works for a mailbox before rules depend on it. */
export async function testCalendarAccess(
  calendarEmail: string
): Promise<{ data: { ok: true } | null; error: string | null }> {
  const admin = await getAdminUser();
  if (!admin) return { data: null, error: "Unauthorized" };

  return verifyDelegation(calendarEmail.toLowerCase().trim(), CALENDAR_SCOPES);
}

/** Runs the same work as the cron, on demand from the UI. */
export async function runCalendarSyncNow(): Promise<{
  data: CalendarSyncSummary | null;
  error: string | null;
}> {
  const admin = await getAdminUser();
  if (!admin) return { data: null, error: "Unauthorized" };

  console.log("[Recording Rules] manual calendar sync requested...");
  const result = await syncCalendarsAndScheduleBots();

  revalidatePath(RULES_PATH);
  return result;
}

/**
 * Pulls finished recordings in without waiting for the cron or a webhook, which
 * is the quickest way to recover a call whose transcript never arrived.
 */
export async function pollRecordingsNow(): Promise<{
  data: RecorderPollSummary | null;
  error: string | null;
}> {
  const admin = await getAdminUser();
  if (!admin) return { data: null, error: "Unauthorized" };

  console.log("[Recording Rules] manual recording poll requested...");
  const result = await pollPendingRecordings();

  revalidatePath(RULES_PATH);
  return result;
}

/** Forces the next sync to re-read the full window for one calendar. */
export async function resetCalendarSyncToken(
  calendarEmail: string
): Promise<{ data: { ok: true } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { data: null, error: "Unauthorized" };

    await prisma.calendarSyncState.updateMany({
      where: { calendarEmail: calendarEmail.toLowerCase().trim() },
      data: { syncToken: null, lastError: null },
    });

    revalidatePath(RULES_PATH);
    return { data: { ok: true }, error: null };
  } catch (error) {
    console.error("[Recording Rules] failed to reset sync token:", error);
    return { data: null, error: "Failed to reset sync token" };
  }
}

/**
 * Sends the notetaker into a meeting straight away from a pasted link, for calls
 * that never made it onto a watched calendar.
 */
export async function joinMeetingNow(input: {
  meetingUrl: string;
  title?: string | null;
}): Promise<{
  data: StartManualRecordingResult | null;
  error: string | null;
}> {
  const admin = await getAdminUser();
  if (!admin) return { data: null, error: "Unauthorized" };

  if (!input.meetingUrl.trim()) {
    return { data: null, error: "Paste a meeting link first" };
  }

  console.log(`[Recording Rules] manual join requested by ${admin.email}...`);

  const result = await startManualRecording({
    meetingUrl: input.meetingUrl,
    title: input.title ?? null,
    calendarEmail: (admin.sendingMailbox ?? admin.email).toLowerCase(),
  });

  revalidatePath(RULES_PATH);
  return result;
}

/**
 * Stops the recording for a single event without changing the rule. A bot that
 * has already joined is asked to leave the call, since it can no longer be
 * deleted.
 */
export async function cancelEventRecording(
  eventId: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { data: null, error: "Unauthorized" };

    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: { id: true, recallBotId: true, decision: true },
    });

    if (!event) return { data: null, error: "Event not found" };

    if (event.recallBotId) {
      const result = await stopBot(
        event.recallBotId,
        event.decision === "RECORDING"
      );
      if (result.error) return { data: null, error: result.error };
    }

    await prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        decision: "CANCELLED",
        decisionReason: "Cancelled manually",
        recallBotId: null,
        botScheduledFor: null,
      },
    });

    revalidatePath(RULES_PATH);
    return { data: { id: eventId }, error: null };
  } catch (error) {
    console.error("[Recording Rules] failed to cancel event recording:", error);
    return { data: null, error: "Failed to cancel recording" };
  }
}
