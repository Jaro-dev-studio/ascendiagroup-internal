import prisma from "@/lib/prisma";
import { getEntityHref } from "../entity-href";
import { defineTool, type AITool } from "../types";

export const deliveryReadTools: AITool[] = [
  defineTool({
    name: "queryDemos",
    label: "Query Product Builds",
    risk: "read",
    description:
      "List demos / product builds including queued builds awaiting admin approval. Returns id, status, repo and deployment info.",
    parameters: {
      properties: {
        status: {
          type: "string",
          description:
            "Filter by status (queued, pending, generating, deploying, ready, failed, rejected)",
        },
        clientId: { type: "string", description: "Filter by client company ID" },
        limit: { type: "number", description: "Maximum number to return (default: 20)" },
      },
    },
    execute: async (args) => {
      const { status, clientId, limit = 20 } = args as {
        status?: string;
        clientId?: string;
        limit?: number;
      };

      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (clientId) where.clientCompanyId = clientId;

      const demos = await prisma.demo.findMany({
        where,
        include: { clientCompany: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
      });

      return {
        count: demos.length,
        demos: demos.map((d) => ({
          id: d.id,
          href: getEntityHref("demo", d.id),
          name: d.name,
          slug: d.slug,
          status: d.status,
          errorMessage: d.errorMessage,
          rejectionReason: d.rejectionReason,
          client: d.clientCompany?.name ?? null,
          clientId: d.clientCompanyId,
          githubRepoUrl: d.githubRepoUrl,
          vercelDeployUrl: d.vercelDeployUrl,
          cursorAgentStatus: d.cursorAgentStatus,
          createdAt: d.createdAt.toISOString(),
        })),
      };
    },
  }),

  defineTool({
    name: "queryWorkflows",
    label: "Query Workflows",
    risk: "read",
    description:
      "List internal workflow maps with their ids, triggers and descriptions. Use this to resolve workflow ids before editing or deleting.",
    parameters: {
      properties: {
        searchQuery: { type: "string", description: "Search by workflow name" },
        limit: { type: "number", description: "Maximum number to return (default: 20)" },
      },
    },
    execute: async (args) => {
      const { searchQuery, limit = 20 } = args as { searchQuery?: string; limit?: number };

      const where: Record<string, unknown> = {};
      if (searchQuery) where.name = { contains: searchQuery, mode: "insensitive" };

      const workflows = await prisma.workflow.findMany({
        where,
        include: { _count: { select: { attachments: true } } },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
      });

      return {
        count: workflows.length,
        workflows: workflows.map((w) => ({
          id: w.id,
          href: getEntityHref("workflow", w.id),
          name: w.name,
          description: w.description,
          triggerType: w.triggerType,
          triggerValue: w.triggerValue,
          triggeredByWorkflowId: w.triggeredByWorkflowId,
          attachments: w._count.attachments,
          createdAt: w.createdAt.toISOString(),
        })),
      };
    },
  }),

  defineTool({
    name: "queryPresentations",
    label: "Query Presentations",
    risk: "read",
    description: "List presentations with their ids and slide counts.",
    parameters: {
      properties: {
        limit: { type: "number", description: "Maximum number to return (default: 20)" },
      },
    },
    execute: async (args) => {
      const { limit = 20 } = args as { limit?: number };

      const presentations = await prisma.presentation.findMany({
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
      });

      return {
        count: presentations.length,
        presentations: presentations.map((p) => ({
          id: p.id,
          href: getEntityHref("presentation", p.id),
          title: p.title,
          slideCount: Array.isArray(p.slides) ? p.slides.length : 0,
          createdAt: p.createdAt.toISOString(),
        })),
      };
    },
  }),
];
