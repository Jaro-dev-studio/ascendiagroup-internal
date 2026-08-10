import prisma from "@/lib/prisma";
import { getEntityHref } from "../entity-href";
import { defineTool, type AITool } from "../types";

export const actionItemReadTools: AITool[] = [
  defineTool({
    name: "queryActionItems",
    label: "Query Action Items",
    risk: "read",
    description:
      "Query action items (client-side tasks/blockers). Returns id, status, priority, client, and blocking relationships. Use this to resolve action item ids before updating or deleting one.",
    parameters: {
      properties: {
        status: {
          type: "array",
          items: {
            type: "string",
            enum: ["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "PENDING_ADMIN_REVIEW"],
          },
          description: "Filter by status",
        },
        priority: {
          type: "array",
          items: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
          description: "Filter by priority",
        },
        clientId: { type: "string", description: "Filter by client company ID" },
        searchQuery: { type: "string", description: "Search in name and description" },
        limit: { type: "number", description: "Maximum number of items to return (default: 20)" },
      },
    },
    execute: async (args) => {
      const { status, priority, clientId, searchQuery, limit = 20 } = args as {
        status?: string[];
        priority?: string[];
        clientId?: string;
        searchQuery?: string;
        limit?: number;
      };

      const where: Record<string, unknown> = {};

      if (status?.length) where.status = { in: status };
      if (priority?.length) where.priority = { in: priority };
      if (clientId) where.clientCompanyId = clientId;
      if (searchQuery) {
        where.OR = [
          { name: { contains: searchQuery, mode: "insensitive" } },
          { description: { contains: searchQuery, mode: "insensitive" } },
        ];
      }

      const actionItems = await prisma.actionItem.findMany({
        where,
        include: {
          clientCompany: { select: { name: true } },
          blockingTasks: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
      });

      return {
        count: actionItems.length,
        actionItems: actionItems.map((a) => ({
          id: a.id,
          href: getEntityHref("actionItem", a.id),
          name: a.name,
          description: a.description,
          status: a.status,
          priority: a.priority,
          client: a.clientCompany.name,
          clientId: a.clientCompanyId,
          clientHref: getEntityHref("client", a.clientCompanyId),
          blockingTasks: a.blockingTasks.map((t) => ({
            id: t.id,
            name: t.name,
            href: getEntityHref("task", t.id),
          })),
          createdAt: a.createdAt.toISOString(),
        })),
      };
    },
  }),
];
