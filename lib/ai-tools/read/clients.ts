import prisma from "@/lib/prisma";
import { getEntityHref } from "../entity-href";
import { defineTool, type AITool } from "../types";

export const clientReadTools: AITool[] = [
  defineTool({
    name: "queryClients",
    label: "Query Clients",
    risk: "read",
    description:
      "Query client companies with their pipeline status, Slack channels and summary statistics. Always use this to resolve a client name to its ID before any client-scoped operation.",
    parameters: {
      properties: {
        searchQuery: { type: "string", description: "Search by company name" },
        status: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "FORM_SUBMITTED",
              "CALL_BOOKED",
              "NO_SHOW",
              "ATTENDED_SALES_CALL",
              "PURCHASED",
              "CHURNED",
            ],
          },
          description: "Filter by pipeline status",
        },
        includeStats: { type: "boolean", description: "Include task/request counts per client" },
        limit: { type: "number", description: "Maximum number of clients to return (default: 20)" },
      },
    },
    execute: async (args) => {
      const { searchQuery, status, includeStats, limit = 20 } = args as {
        searchQuery?: string;
        status?: string[];
        includeStats?: boolean;
        limit?: number;
      };

      const where: Record<string, unknown> = {};
      if (searchQuery) where.name = { contains: searchQuery, mode: "insensitive" };
      if (status?.length) where.status = { in: status };

      const clients = await prisma.company.findMany({
        where,
        include: {
          _count: includeStats
            ? { select: { tasks: true, actionItems: true, requests: true, users: true } }
            : undefined,
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
      });

      return {
        count: clients.length,
        clients: clients.map((c) => ({
          id: c.id,
          href: getEntityHref("client", c.id),
          name: c.name,
          website: c.website,
          status: c.status,
          slackPublicChannelId: c.slackPublicChannelId,
          slackInternalChannelId: c.slackInternalChannelId,
          createdAt: c.createdAt.toISOString(),
          ...(includeStats && c._count
            ? {
              stats: {
                tasks: c._count.tasks,
                actionItems: c._count.actionItems,
                requests: c._count.requests,
                users: c._count.users,
              },
            }
            : {}),
        })),
      };
    },
  }),

  defineTool({
    name: "queryNotificationConfigs",
    label: "Query Notification Configs",
    risk: "read",
    description:
      "Get the Slack notification configuration for a client company, per event type.",
    parameters: {
      properties: {
        clientCompanyId: { type: "string", description: "The client company ID" },
      },
      required: ["clientCompanyId"],
    },
    execute: async (args) => {
      const { clientCompanyId } = args as { clientCompanyId: string };

      const configs = await prisma.slackNotificationConfig.findMany({
        where: { clientCompanyId },
        orderBy: { eventType: "asc" },
      });

      return {
        count: configs.length,
        configs: configs.map((c) => ({
          id: c.id,
          eventType: c.eventType,
          sendToPublic: c.sendToPublic,
          sendToInternal: c.sendToInternal,
        })),
      };
    },
  }),
];
