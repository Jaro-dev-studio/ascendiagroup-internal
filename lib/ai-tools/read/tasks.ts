import prisma from "@/lib/prisma";
import { getEntityHref } from "../entity-href";
import { defineTool, type AITool } from "../types";

export const taskReadTools: AITool[] = [
  defineTool({
    name: "queryTasks",
    label: "Query Tasks",
    risk: "read",
    description:
      "Query development tasks with optional filters. Returns task information including id, status, priority, assignee, client, and due dates. Use this to resolve task ids before updating or deleting a task.",
    parameters: {
      properties: {
        status: {
          type: "array",
          items: { type: "string", enum: ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] },
          description: "Filter by task status",
        },
        priority: {
          type: "array",
          items: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
          description: "Filter by priority",
        },
        clientId: { type: "string", description: "Filter by client company ID" },
        assigneeId: { type: "string", description: "Filter by assignee user ID" },
        searchQuery: { type: "string", description: "Search in task name and description" },
        overdue: { type: "boolean", description: "If true, only return overdue tasks" },
        limit: { type: "number", description: "Maximum number of tasks to return (default: 20)" },
      },
    },
    execute: async (args) => {
      const { status, priority, clientId, assigneeId, searchQuery, overdue, limit = 20 } = args as {
        status?: string[];
        priority?: string[];
        clientId?: string;
        assigneeId?: string;
        searchQuery?: string;
        overdue?: boolean;
        limit?: number;
      };

      const where: Record<string, unknown> = {};

      if (status?.length) where.status = { in: status };
      if (priority?.length) where.priority = { in: priority };
      if (clientId) where.clientCompanyId = clientId;
      if (assigneeId) where.assigneeId = assigneeId;
      if (searchQuery) {
        where.OR = [
          { name: { contains: searchQuery, mode: "insensitive" } },
          { description: { contains: searchQuery, mode: "insensitive" } },
        ];
      }
      if (overdue) {
        where.dueDate = { lt: new Date() };
        where.status = { not: "DONE" };
      }

      const tasks = await prisma.task.findMany({
        where,
        include: {
          clientCompany: { select: { name: true } },
          assignee: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
      });

      return {
        count: tasks.length,
        tasks: tasks.map((t) => ({
          id: t.id,
          href: getEntityHref("task", t.id),
          name: t.name,
          description: t.description,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString(),
          client: t.clientCompany.name,
          clientId: t.clientCompanyId,
          clientHref: getEntityHref("client", t.clientCompanyId),
          assignee: t.assignee
            ? `${t.assignee.firstName || ""} ${t.assignee.lastName || ""}`.trim() ||
              t.assignee.email
            : "Unassigned",
          assigneeId: t.assigneeId,
          createdAt: t.createdAt.toISOString(),
        })),
      };
    },
  }),

  defineTool({
    name: "getTaskStats",
    label: "Get Task Statistics",
    risk: "read",
    description: "Get aggregated task statistics and counts by status, priority, client, or assignee.",
    parameters: {
      properties: {
        groupBy: {
          type: "string",
          enum: ["status", "priority", "client", "assignee"],
          description: "Group results by this field",
        },
      },
      required: ["groupBy"],
    },
    execute: async (args) => {
      const { groupBy } = args as { groupBy: string };

      if (groupBy === "status") {
        const stats = await prisma.task.groupBy({ by: ["status"], _count: { _all: true } });
        return {
          groupBy: "status",
          data: stats.map((s) => ({ status: s.status, count: s._count._all })),
        };
      }

      if (groupBy === "priority") {
        const stats = await prisma.task.groupBy({ by: ["priority"], _count: { _all: true } });
        return {
          groupBy: "priority",
          data: stats.map((s) => ({ priority: s.priority, count: s._count._all })),
        };
      }

      if (groupBy === "client") {
        const clients = await prisma.company.findMany({
          include: { _count: { select: { tasks: true } } },
        });
        return {
          groupBy: "client",
          data: clients.map((c) => ({ client: c.name, clientId: c.id, count: c._count.tasks })),
        };
      }

      if (groupBy === "assignee") {
        const users = await prisma.user.findMany({
          where: { role: { in: ["ADMIN", "DEVELOPER"] } },
          include: { _count: { select: { assignedTasks: true } } },
        });
        return {
          groupBy: "assignee",
          data: users.map((u) => ({
            assignee: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
            assigneeId: u.id,
            count: u._count.assignedTasks,
          })),
        };
      }

      return { error: "Invalid groupBy value" };
    },
  }),

  defineTool({
    name: "queryRecurringTasks",
    label: "Query Recurring Tasks",
    risk: "read",
    description:
      "Query recurring task schedules. Returns id, name, frequency, active state, client, and assignee.",
    parameters: {
      properties: {
        clientId: { type: "string", description: "Filter by client company ID" },
        isActive: { type: "boolean", description: "Filter by active state" },
        limit: { type: "number", description: "Maximum number to return (default: 20)" },
      },
    },
    execute: async (args) => {
      const { clientId, isActive, limit = 20 } = args as {
        clientId?: string;
        isActive?: boolean;
        limit?: number;
      };

      const where: Record<string, unknown> = {};
      if (clientId) where.clientCompanyId = clientId;
      if (typeof isActive === "boolean") where.isActive = isActive;

      const recurringTasks = await prisma.recurringTask.findMany({
        where,
        include: {
          clientCompany: { select: { name: true } },
          assignee: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
      });

      return {
        count: recurringTasks.length,
        recurringTasks: recurringTasks.map((r) => ({
          id: r.id,
          href: getEntityHref("recurringTask", r.id),
          name: r.name,
          description: r.description,
          priority: r.priority,
          frequency: r.frequency,
          dayOfWeek: r.dayOfWeek,
          dayOfMonth: r.dayOfMonth,
          isActive: r.isActive,
          client: r.clientCompany.name,
          clientId: r.clientCompanyId,
          assignee: r.assignee
            ? `${r.assignee.firstName || ""} ${r.assignee.lastName || ""}`.trim() ||
              r.assignee.email
            : "Unassigned",
          lastCreatedAt: r.lastCreatedAt?.toISOString() ?? null,
        })),
      };
    },
  }),
];
