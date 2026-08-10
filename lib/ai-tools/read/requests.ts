import prisma from "@/lib/prisma";
import { getEntityHref, getRequestHref } from "../entity-href";
import { defineTool, type AITool } from "../types";

export const requestReadTools: AITool[] = [
  defineTool({
    name: "queryRequests",
    label: "Query Requests",
    risk: "read",
    description:
      "Query feature requests and bug reports from clients. Returns id, title, status, priority, and severity. Use this to resolve request ids before accepting, rejecting, updating, or deleting one.",
    parameters: {
      properties: {
        type: { type: "string", enum: ["FEATURE", "BUG"], description: "Filter by request type" },
        status: {
          type: "array",
          items: { type: "string", enum: ["SUBMITTED", "ACCEPTED", "REJECTED"] },
          description: "Filter by status",
        },
        clientId: { type: "string", description: "Filter by client company ID" },
        bugSeverity: {
          type: "string",
          enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
          description: "Filter bugs by severity",
        },
        limit: { type: "number", description: "Maximum number of requests to return (default: 20)" },
      },
    },
    execute: async (args) => {
      const { type, status, clientId, bugSeverity, limit = 20 } = args as {
        type?: string;
        status?: string[];
        clientId?: string;
        bugSeverity?: string;
        limit?: number;
      };

      const where: Record<string, unknown> = {};

      if (type) where.type = type;
      if (status?.length) where.status = { in: status };
      if (clientId) where.clientCompanyId = clientId;
      if (bugSeverity) where.bugSeverity = bugSeverity;

      const requests = await prisma.request.findMany({
        where,
        include: { clientCompany: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
      });

      return {
        count: requests.length,
        requests: requests.map((r) => ({
          id: r.id,
          href: getRequestHref(r.type),
          title: r.title,
          description: r.description,
          type: r.type,
          status: r.status,
          priority: r.priority,
          bugSeverity: r.bugSeverity,
          client: r.clientCompany.name,
          clientId: r.clientCompanyId,
          clientHref: getEntityHref("client", r.clientCompanyId),
          createdAt: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  defineTool({
    name: "getRequestStats",
    label: "Get Request Statistics",
    risk: "read",
    description: "Get aggregated request statistics and counts.",
    parameters: {
      properties: {
        groupBy: {
          type: "string",
          enum: ["status", "type", "client", "bugSeverity"],
          description: "Group results by this field",
        },
      },
      required: ["groupBy"],
    },
    execute: async (args) => {
      const { groupBy } = args as { groupBy: string };

      if (groupBy === "status") {
        const stats = await prisma.request.groupBy({ by: ["status"], _count: { _all: true } });
        return {
          groupBy: "status",
          data: stats.map((s) => ({ status: s.status, count: s._count._all })),
        };
      }

      if (groupBy === "type") {
        const stats = await prisma.request.groupBy({ by: ["type"], _count: { _all: true } });
        return {
          groupBy: "type",
          data: stats.map((s) => ({ type: s.type, count: s._count._all })),
        };
      }

      if (groupBy === "client") {
        const clients = await prisma.company.findMany({
          include: { _count: { select: { requests: true } } },
        });
        return {
          groupBy: "client",
          data: clients.map((c) => ({ client: c.name, clientId: c.id, count: c._count.requests })),
        };
      }

      if (groupBy === "bugSeverity") {
        const stats = await prisma.request.groupBy({
          by: ["bugSeverity"],
          where: { type: "BUG", bugSeverity: { not: null } },
          _count: { _all: true },
        });
        return {
          groupBy: "bugSeverity",
          data: stats.map((s) => ({ severity: s.bugSeverity, count: s._count._all })),
        };
      }

      return { error: "Invalid groupBy value" };
    },
  }),
];
