import prisma from "@/lib/prisma";
import { getEntityHref } from "../entity-href";
import { defineTool, type AITool } from "../types";

export const govReadTools: AITool[] = [
  defineTool({
    name: "queryGovContracts",
    label: "Query Gov Contracts",
    risk: "read",
    description:
      "List government contract pipeline entries with status, agency, deadlines and values. Use this to resolve contract ids before advancing, editing, or deleting.",
    parameters: {
      properties: {
        status: {
          type: "array",
          items: { type: "string" },
          description: "Filter by GovContractStatus values",
        },
        searchQuery: { type: "string", description: "Search by title, agency or solicitation number" },
        limit: { type: "number", description: "Maximum number to return (default: 20)" },
      },
    },
    execute: async (args) => {
      const { status, searchQuery, limit = 20 } = args as {
        status?: string[];
        searchQuery?: string;
        limit?: number;
      };

      const where: Record<string, unknown> = {};
      if (status?.length) where.status = { in: status };
      if (searchQuery) {
        where.OR = [
          { title: { contains: searchQuery, mode: "insensitive" } },
          { agency: { contains: searchQuery, mode: "insensitive" } },
          { solicitationNumber: { contains: searchQuery, mode: "insensitive" } },
        ];
      }

      const contracts = await prisma.govContract.findMany({
        where,
        include: { _count: { select: { contacts: true, activities: true } } },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
      });

      return {
        count: contracts.length,
        contracts: contracts.map((c) => ({
          id: c.id,
          href: getEntityHref("govContract", c.id),
          title: c.title,
          agency: c.agency,
          subAgency: c.subAgency,
          solicitationNumber: c.solicitationNumber,
          naicsCode: c.naicsCode,
          setAsideType: c.setAsideType,
          status: c.status,
          estimatedValue: c.estimatedValue,
          awardAmount: c.awardAmount,
          responseDeadline: c.responseDeadline?.toISOString() ?? null,
          contacts: c._count.contacts,
          activities: c._count.activities,
        })),
      };
    },
  }),

  defineTool({
    name: "queryGovOpportunities",
    label: "Query Gov Opportunities",
    risk: "read",
    description:
      "List SAM.gov opportunities synced into the system, including AI analysis scores. Use this to resolve opportunity ids before importing or dismissing.",
    parameters: {
      properties: {
        dismissed: { type: "boolean", description: "Filter by dismissed state" },
        searchQuery: { type: "string", description: "Search by title or agency" },
        limit: { type: "number", description: "Maximum number to return (default: 20)" },
      },
    },
    execute: async (args) => {
      const { dismissed, searchQuery, limit = 20 } = args as {
        dismissed?: boolean;
        searchQuery?: string;
        limit?: number;
      };

      const where: Record<string, unknown> = {};
      if (typeof dismissed === "boolean") where.isDismissed = dismissed;
      if (searchQuery) {
        where.OR = [
          { title: { contains: searchQuery, mode: "insensitive" } },
          { agency: { contains: searchQuery, mode: "insensitive" } },
        ];
      }

      const opportunities = await prisma.govOpportunity.findMany({
        where,
        include: { analysis: true },
        orderBy: { postedDate: "desc" },
        take: Math.min(limit, 50),
      });

      return {
        count: opportunities.length,
        opportunities: opportunities.map((o) => ({
          id: o.id,
          title: o.title,
          agency: o.agency,
          type: o.type,
          responseDeadline: o.responseDeadline?.toISOString() ?? null,
          isDismissed: o.isDismissed,
          isImported: o.isImported,
          overallScore: o.analysis?.overallScore ?? null,
          recommendation: o.analysis?.recommendation ?? null,
        })),
      };
    },
  }),
];
