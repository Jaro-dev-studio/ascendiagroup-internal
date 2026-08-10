import prisma from "@/lib/prisma";
import { getEntityHref } from "../entity-href";
import { defineTool, type AITool } from "../types";

export const salesReadTools: AITool[] = [
  defineTool({
    name: "querySalesCallMaps",
    label: "Query Sales Call Maps",
    risk: "read",
    description:
      "List ops-audit sales call maps and their shared quotes. Use this to resolve sales call map ids before editing or deleting.",
    parameters: {
      properties: {
        searchQuery: { type: "string", description: "Search by map name" },
        clientId: { type: "string", description: "Filter by client company ID" },
        limit: { type: "number", description: "Maximum number to return (default: 20)" },
      },
    },
    execute: async (args) => {
      const { searchQuery, clientId, limit = 20 } = args as {
        searchQuery?: string;
        clientId?: string;
        limit?: number;
      };

      const where: Record<string, unknown> = {};
      if (searchQuery) where.name = { contains: searchQuery, mode: "insensitive" };
      if (clientId) where.clientCompanyId = clientId;

      const maps = await prisma.salesCallMap.findMany({
        where,
        include: {
          clientCompany: { select: { name: true } },
          sharedQuotes: { select: { id: true, companyName: true, total: true, token: true } },
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
      });

      return {
        count: maps.length,
        salesCallMaps: maps.map((m) => ({
          id: m.id,
          href: getEntityHref("salesCallMap", m.id),
          name: m.name,
          notes: m.notes,
          client: m.clientCompany?.name ?? null,
          clientId: m.clientCompanyId,
          quotes: m.sharedQuotes.map((q) => ({
            id: q.id,
            companyName: q.companyName,
            total: q.total,
            token: q.token,
          })),
          createdAt: m.createdAt.toISOString(),
        })),
      };
    },
  }),

  defineTool({
    name: "queryMvpCallMaps",
    label: "Query MVP Call Maps",
    risk: "read",
    description:
      "List MVP product builder call maps and their shared quotes. Use this to resolve MVP call map ids before editing or deleting.",
    parameters: {
      properties: {
        searchQuery: { type: "string", description: "Search by map name" },
        clientId: { type: "string", description: "Filter by client company ID" },
        limit: { type: "number", description: "Maximum number to return (default: 20)" },
      },
    },
    execute: async (args) => {
      const { searchQuery, clientId, limit = 20 } = args as {
        searchQuery?: string;
        clientId?: string;
        limit?: number;
      };

      const where: Record<string, unknown> = {};
      if (searchQuery) where.name = { contains: searchQuery, mode: "insensitive" };
      if (clientId) where.clientCompanyId = clientId;

      const maps = await prisma.mVPCallMap.findMany({
        where,
        include: {
          clientCompany: { select: { name: true } },
          sharedQuotes: { select: { id: true, companyName: true, total: true, token: true } },
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
      });

      return {
        count: maps.length,
        mvpCallMaps: maps.map((m) => ({
          id: m.id,
          href: getEntityHref("mvpCallMap", m.id),
          name: m.name,
          notes: m.notes,
          client: m.clientCompany?.name ?? null,
          clientId: m.clientCompanyId,
          quotes: m.sharedQuotes.map((q) => ({
            id: q.id,
            companyName: q.companyName,
            total: q.total,
            token: q.token,
          })),
          createdAt: m.createdAt.toISOString(),
        })),
      };
    },
  }),
];
