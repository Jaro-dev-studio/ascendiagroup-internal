import prisma from "@/lib/prisma";
import {
  isGoogleWorkspaceConfigured,
  isWorkspaceMailbox,
  getWorkspaceDomain,
} from "@/lib/integrations/google-auth";
import { isRecallConfigured, getRecallRegion } from "@/lib/integrations/recall";
import type { RecordingDecision } from "@prisma/client";

export interface RecordingRuleView {
  id: string;
  calendarEmail: string;
  enabled: boolean;
  userId: string | null;
  userName: string | null;
  requireExternalAttendee: boolean;
  minAttendees: number;
  titleIncludes: string[];
  titleExcludes: string[];
  skipAllDayEvents: boolean;
  onlyIfOrganizer: boolean;
  botName: string;
  joinMinutesBefore: number;
  lastSyncedAt: Date | null;
  lastError: string | null;
  scheduledCount: number;
}

export interface CalendarEventView {
  id: string;
  title: string | null;
  calendarEmail: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  organizer: string | null;
  attendees: string[];
  status: string | null;
  platform: string | null;
  meetingUrl: string | null;
  decision: RecordingDecision;
  decisionReason: string | null;
  recallBotId: string | null;
  botScheduledFor: Date | null;
  meetingDbId: string | null;
}

export interface CalendarEventsOptions {
  limit?: number;
  /** Only events that have not started yet, oldest first. */
  upcomingOnly?: boolean;
  /** Drop events Google reports as cancelled. Always on for upcoming. */
  excludeCancelled?: boolean;
}

export interface RecorderConfigStatus {
  googleConfigured: boolean;
  recallConfigured: boolean;
  recallRegion: string;
  workspaceDomain: string;
}

export async function getRecordingRules(): Promise<{
  data: RecordingRuleView[] | null;
  error: string | null;
}> {
  try {
    const [rules, syncStates, scheduledCounts] = await Promise.all([
      prisma.recordingRule.findMany({
        orderBy: { calendarEmail: "asc" },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.calendarSyncState.findMany(),
      prisma.calendarEvent.groupBy({
        by: ["calendarEmail"],
        where: { decision: "SCHEDULED", startTime: { gte: new Date() } },
        _count: { _all: true },
      }),
    ]);

    const syncByEmail = new Map(
      syncStates.map((state) => [state.calendarEmail, state])
    );
    const countByEmail = new Map(
      scheduledCounts.map((row) => [row.calendarEmail, row._count._all])
    );

    return {
      data: rules.map((rule) => {
        const syncState = syncByEmail.get(rule.calendarEmail);
        const name = rule.user
          ? [rule.user.firstName, rule.user.lastName].filter(Boolean).join(" ") ||
            rule.user.email
          : null;

        return {
          id: rule.id,
          calendarEmail: rule.calendarEmail,
          enabled: rule.enabled,
          userId: rule.userId,
          userName: name,
          requireExternalAttendee: rule.requireExternalAttendee,
          minAttendees: rule.minAttendees,
          titleIncludes: rule.titleIncludes,
          titleExcludes: rule.titleExcludes,
          skipAllDayEvents: rule.skipAllDayEvents,
          onlyIfOrganizer: rule.onlyIfOrganizer,
          botName: rule.botName,
          joinMinutesBefore: rule.joinMinutesBefore,
          lastSyncedAt: syncState?.lastSyncedAt ?? null,
          lastError: syncState?.lastError ?? null,
          scheduledCount: countByEmail.get(rule.calendarEmail) ?? 0,
        };
      }),
      error: null,
    };
  } catch (error) {
    console.error("[Recording Rules] failed to fetch rules:", error);
    return { data: null, error: "Failed to load recording rules" };
  }
}

/**
 * Recent and upcoming events, so the UI can show what will and will not record.
 * With `upcomingOnly` the window starts at now, so a busy past week can never
 * push future events past the limit.
 */
export async function getCalendarEvents(
  options: CalendarEventsOptions = {}
): Promise<{
  data: CalendarEventView[] | null;
  error: string | null;
}> {
  const { limit = 60, upcomingOnly = false, excludeCancelled = false } = options;

  try {
    const from = upcomingOnly
      ? new Date()
      : new Date(Date.now() - 7 * 86_400_000);

    const events = await prisma.calendarEvent.findMany({
      where: {
        startTime: { gte: from },
        ...(upcomingOnly || excludeCancelled
          ? { NOT: { status: "cancelled" } }
          : {}),
      },
      orderBy: { startTime: "asc" },
      take: limit,
      select: {
        id: true,
        title: true,
        calendarEmail: true,
        startTime: true,
        endTime: true,
        isAllDay: true,
        organizer: true,
        attendees: true,
        status: true,
        platform: true,
        meetingUrl: true,
        decision: true,
        decisionReason: true,
        recallBotId: true,
        botScheduledFor: true,
        meetingDbId: true,
      },
    });

    return { data: events, error: null };
  } catch (error) {
    console.error("[Recording Rules] failed to fetch calendar events:", error);
    return { data: null, error: "Failed to load calendar events" };
  }
}

/** Workspace mailboxes we can actually impersonate, for the rule picker. */
export async function getWorkspaceMailboxes(): Promise<{
  data: Array<{ userId: string; email: string; name: string }> | null;
  error: string | null;
}> {
  try {
    const users = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        sendingMailbox: true,
      },
      orderBy: { email: "asc" },
    });

    const mailboxes = users
      .map((user) => {
        const mailbox = [user.sendingMailbox, user.email].find(
          (candidate): candidate is string =>
            Boolean(candidate) && isWorkspaceMailbox(candidate as string)
        );
        if (!mailbox) return null;

        return {
          userId: user.id,
          email: mailbox.toLowerCase(),
          name:
            [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            user.email,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return { data: mailboxes, error: null };
  } catch (error) {
    console.error("[Recording Rules] failed to fetch mailboxes:", error);
    return { data: null, error: "Failed to load workspace mailboxes" };
  }
}

export async function getRecorderConfigStatus(): Promise<RecorderConfigStatus> {
  return {
    googleConfigured: isGoogleWorkspaceConfigured(),
    recallConfigured: isRecallConfigured(),
    recallRegion: getRecallRegion(),
    workspaceDomain: getWorkspaceDomain(),
  };
}
