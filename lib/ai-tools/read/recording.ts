import {
  getCalendarEvents,
  getRecorderConfigStatus,
  getRecordingRules,
} from "@/lib/fetchers/recording-rules";
import { getEntityHref } from "../entity-href";
import { defineTool, type AITool } from "../types";

const DECISION_ENUM = [
  "PENDING",
  "SCHEDULED",
  "SKIPPED",
  "DUPLICATE",
  "RECORDING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export const recordingReadTools: AITool[] = [
  defineTool({
    name: "queryRecordingRules",
    label: "Query Recording Rules",
    risk: "read",
    description:
      "List the meeting recorder rules, one per watched calendar: whether recording is enabled, the matching conditions, the bot settings, last calendar sync time and how many upcoming events are scheduled to record. Also reports whether Google Workspace and Recall.ai are configured.",
    parameters: {
      properties: {
        calendarEmail: { type: "string", description: "Filter to one calendar email" },
        enabledOnly: { type: "boolean", description: "Only return enabled rules" },
      },
    },
    execute: async (args) => {
      const { calendarEmail, enabledOnly } = args as {
        calendarEmail?: string;
        enabledOnly?: boolean;
      };

      const [result, config] = await Promise.all([
        getRecordingRules(),
        getRecorderConfigStatus(),
      ]);

      if (result.error) throw new Error(result.error);

      let rules = result.data ?? [];
      if (calendarEmail) {
        const needle = calendarEmail.toLowerCase();
        rules = rules.filter((rule) => rule.calendarEmail.toLowerCase().includes(needle));
      }
      if (enabledOnly) rules = rules.filter((rule) => rule.enabled);

      return {
        config,
        count: rules.length,
        rules: rules.map((rule) => ({
          ...rule,
          lastSyncedAt: rule.lastSyncedAt?.toISOString() ?? null,
        })),
      };
    },
  }),

  defineTool({
    name: "queryCalendarEvents",
    label: "Query Calendar Events",
    risk: "read",
    description:
      "The schedule: meetings synced from the team's Google Calendars, with the recording decision for each (scheduled, skipped, recording, completed) and the reason. This is the tool for upcoming or scheduled calls and meetings, including today's and this week's: call it with upcomingOnly true. Also use it to explain why a meeting was or was not recorded. Calendars are synced every 10 minutes and cover the next 14 days.",
    parameters: {
      properties: {
        calendarEmail: { type: "string", description: "Filter to one calendar email" },
        decision: {
          type: "array",
          items: { type: "string", enum: [...DECISION_ENUM] },
          description: "Filter by recording decision",
        },
        upcomingOnly: {
          type: "boolean",
          description:
            "Only events that have not started yet, soonest first. Use this for upcoming or scheduled calls",
        },
        searchQuery: { type: "string", description: "Filter by event title" },
        limit: { type: "number", description: "Maximum events to return (default 40, max 100)" },
      },
    },
    execute: async (args) => {
      const { calendarEmail, decision, upcomingOnly, searchQuery, limit = 40 } = args as {
        calendarEmail?: string;
        decision?: string[];
        upcomingOnly?: boolean;
        searchQuery?: string;
        limit?: number;
      };

      const capped = Math.min(limit, 100);

      // Filtering below narrows the rows further, so over-fetch. The window
      // itself has to start at now for upcoming, otherwise a busy past week
      // fills the limit and hides every future event.
      console.log(
        `[queryCalendarEvents] loading ${upcomingOnly ? "upcoming" : "recent and upcoming"} calendar events...`
      );
      const result = await getCalendarEvents({ limit: 200, upcomingOnly });
      if (result.error) throw new Error(result.error);

      let events = result.data ?? [];

      if (calendarEmail) {
        const needle = calendarEmail.toLowerCase();
        events = events.filter((event) => event.calendarEmail.toLowerCase().includes(needle));
      }
      if (decision?.length) {
        events = events.filter((event) => decision.includes(event.decision));
      }
      if (searchQuery) {
        const needle = searchQuery.toLowerCase();
        events = events.filter((event) => (event.title ?? "").toLowerCase().includes(needle));
      }

      const limited = events.slice(0, capped);

      return {
        count: limited.length,
        syncWindow: "Google Calendar sync covers the next 14 days, refreshed every 10 minutes",
        events: limited.map((event) => ({
          ...event,
          startTime: event.startTime.toISOString(),
          endTime: event.endTime.toISOString(),
          botScheduledFor: event.botScheduledFor?.toISOString() ?? null,
          // The recording, once ingested, is the call record in the dashboard
          href: event.meetingDbId
            ? getEntityHref("meeting", event.meetingDbId)
            : getEntityHref("calendarEvent"),
        })),
      };
    },
  }),
];
