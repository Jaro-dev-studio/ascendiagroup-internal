import prisma from "@/lib/prisma";
import { getEntityHref } from "../entity-href";
import { defineTool, type AITool } from "../types";

export const callReadTools: AITool[] = [
  defineTool({
    name: "queryCalls",
    label: "Query Calls",
    risk: "read",
    description:
      "Query calls that already happened and were recorded: title, participants, summary and next steps. Use this to find past calls and resolve their ids. It holds no future meetings, so for upcoming or scheduled calls use queryCalendarEvents with upcomingOnly instead.",
    parameters: {
      properties: {
        clientId: { type: "string", description: "Filter by client company ID" },
        daysAgo: { type: "number", description: "Get calls from the last N days" },
        searchQuery: { type: "string", description: "Search in call title, summary, or next steps" },
        limit: { type: "number", description: "Maximum number of calls to return (default: 10)" },
      },
    },
    execute: async (args) => {
      const { clientId, daysAgo, searchQuery, limit = 10 } = args as {
        clientId?: string;
        daysAgo?: number;
        searchQuery?: string;
        limit?: number;
      };

      const where: Record<string, unknown> = {};

      if (clientId) where.clientCompanyId = clientId;
      if (daysAgo) {
        const since = new Date();
        since.setDate(since.getDate() - daysAgo);
        where.startTime = { gte: since };
      }
      if (searchQuery) {
        where.OR = [
          { title: { contains: searchQuery, mode: "insensitive" } },
          { summary: { contains: searchQuery, mode: "insensitive" } },
          { nextStepsJaroDev: { contains: searchQuery, mode: "insensitive" } },
          { nextStepsClient: { contains: searchQuery, mode: "insensitive" } },
          { formattedTranscript: { contains: searchQuery, mode: "insensitive" } },
        ];
      }

      const calls = await prisma.meeting.findMany({
        where,
        include: {
          clientCompany: { select: { id: true, name: true } },
          _count: { select: { tasks: true, actionItems: true } },
        },
        orderBy: { startTime: "desc" },
        take: Math.min(limit, 20),
      });

      return {
        count: calls.length,
        calls: calls.map((c) => ({
          id: c.id,
          href: getEntityHref("meeting", c.id),
          title: c.title,
          description: c.description,
          startTime: c.startTime.toISOString(),
          endTime: c.endTime.toISOString(),
          participants: c.participants,
          client: c.clientCompany?.name || null,
          clientId: c.clientCompanyId,
          clientHref: c.clientCompany
            ? getEntityHref("client", c.clientCompany.id)
            : null,
          summary: c.summary,
          nextStepsJaroDev: c.nextStepsJaroDev,
          nextStepsClient: c.nextStepsClient,
          tasksCreated: c._count.tasks,
          actionItemsCreated: c._count.actionItems,
        })),
      };
    },
  }),

  defineTool({
    name: "getCallTranscript",
    label: "Get Call Transcript",
    risk: "read",
    description:
      "Get the full transcript of a specific call. Use this when you need to answer detailed questions about what was discussed in a call.",
    parameters: {
      properties: {
        callId: { type: "string", description: "The ID of the call/meeting" },
      },
      required: ["callId"],
    },
    execute: async (args) => {
      const { callId } = args as { callId: string };

      if (!callId) return { error: "callId is required" };

      const call = await prisma.meeting.findUnique({
        where: { id: callId },
        include: { clientCompany: { select: { name: true } } },
      });

      if (!call) return { error: "Call not found" };

      return {
        id: call.id,
        href: getEntityHref("meeting", call.id),
        title: call.title,
        startTime: call.startTime.toISOString(),
        endTime: call.endTime.toISOString(),
        participants: call.participants,
        client: call.clientCompany?.name || null,
        summary: call.summary,
        nextStepsJaroDev: call.nextStepsJaroDev,
        nextStepsClient: call.nextStepsClient,
        transcript: call.formattedTranscript,
      };
    },
  }),

  defineTool({
    name: "queryFollowups",
    label: "Query Followups",
    risk: "read",
    description:
      "List followup templates and generated meeting followups. Use this to resolve template ids before generating a followup, or followup ids before editing or sending one.",
    parameters: {
      properties: {
        meetingId: { type: "string", description: "Only return followups for this meeting" },
        templatesOnly: { type: "boolean", description: "Only return the followup templates" },
        limit: { type: "number", description: "Maximum number of followups (default: 20)" },
      },
    },
    execute: async (args) => {
      const { meetingId, templatesOnly, limit = 20 } = args as {
        meetingId?: string;
        templatesOnly?: boolean;
        limit?: number;
      };

      const templates = await prisma.followupTemplate.findMany({ orderBy: { createdAt: "desc" } });

      if (templatesOnly) {
        return {
          templates: templates.map((t) => ({ id: t.id, name: t.name, prompt: t.prompt })),
        };
      }

      const followups = await prisma.meetingFollowup.findMany({
        where: meetingId ? { meetingId } : {},
        include: {
          template: { select: { name: true } },
          meeting: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
      });

      return {
        templates: templates.map((t) => ({ id: t.id, name: t.name })),
        followups: followups.map((f) => ({
          id: f.id,
          meeting: f.meeting.title,
          meetingId: f.meetingId,
          meetingHref: getEntityHref("meeting", f.meetingId),
          template: f.template.name,
          status: f.status,
          sentTo: f.sentTo,
          sentAt: f.sentAt?.toISOString() ?? null,
          contentPreview: f.content.slice(0, 400),
        })),
      };
    },
  }),
];
