import prisma from "@/lib/prisma";
import { defineTool, type AITool } from "../types";

export const userReadTools: AITool[] = [
  defineTool({
    name: "queryUsers",
    label: "Query Users",
    risk: "read",
    description:
      "Query users in the system. Use this to resolve a person's name or email to their user ID before assigning work or changing their role.",
    parameters: {
      properties: {
        role: {
          type: "string",
          enum: ["ADMIN", "DEVELOPER", "CLIENT"],
          description: "Filter by user role",
        },
        clientId: { type: "string", description: "Filter by client company ID" },
        searchQuery: { type: "string", description: "Search by name or email" },
        limit: { type: "number", description: "Maximum number of users to return (default: 20)" },
      },
    },
    execute: async (args) => {
      const { role, clientId, searchQuery, limit = 20 } = args as {
        role?: string;
        clientId?: string;
        searchQuery?: string;
        limit?: number;
      };

      const where: Record<string, unknown> = {};

      if (role) where.role = role;
      if (clientId) where.clientCompanyId = clientId;
      if (searchQuery) {
        where.OR = [
          { email: { contains: searchQuery, mode: "insensitive" } },
          { firstName: { contains: searchQuery, mode: "insensitive" } },
          { lastName: { contains: searchQuery, mode: "insensitive" } },
        ];
      }

      const users = await prisma.user.findMany({
        where,
        include: {
          clientCompany: { select: { name: true } },
          _count: { select: { assignedTasks: true } },
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
      });

      return {
        count: users.length,
        users: users.map((u) => ({
          id: u.id,
          name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
          email: u.email,
          role: u.role,
          clientCompany: u.clientCompany?.name || null,
          clientCompanyId: u.clientCompanyId,
          assignedTasksCount: u._count.assignedTasks,
          createdAt: u.createdAt.toISOString(),
        })),
      };
    },
  }),
];
