import prisma from "@/lib/prisma";
import { searchKnowledgeBase } from "@/lib/knowledge-base/search";
import { defineTool, type AITool } from "../types";

export const knowledgeBaseReadTools: AITool[] = [
  defineTool({
    name: "searchKnowledgeBase",
    label: "Search Knowledge Base",
    risk: "read",
    description:
      "Search the internal knowledge base for relevant documents and reference materials. Uses semantic similarity. Use this when you need context for decisions, asset generation, or to answer questions about company processes, policies, technical documentation, or reference materials.",
    parameters: {
      properties: {
        query: {
          type: "string",
          description: "A natural language search query describing what information you need",
        },
        topK: { type: "number", description: "Number of matching chunks to return (default: 5, max: 10)" },
      },
      required: ["query"],
    },
    execute: async (args) => {
      const { query, topK = 5 } = args as { query: string; topK?: number };

      if (!query) return { error: "query is required" };

      const results = await searchKnowledgeBase(query, Math.min(topK, 10));

      return {
        count: results.length,
        results: results.map((r) => ({
          documentTitle: r.documentTitle,
          content: r.content,
          similarity: r.similarity.toFixed(4),
        })),
      };
    },
  }),

  defineTool({
    name: "listKnowledgeBaseDocuments",
    label: "List Knowledge Base Documents",
    risk: "read",
    description:
      "List knowledge base documents with their ids and processing status. Use this to resolve document ids before deleting or reprocessing.",
    parameters: {
      properties: {
        limit: { type: "number", description: "Maximum number to return (default: 25)" },
      },
    },
    execute: async (args) => {
      const { limit = 25 } = args as { limit?: number };

      const documents = await prisma.knowledgeBaseDocument.findMany({
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
        include: { _count: { select: { chunks: true } } },
      });

      return {
        count: documents.length,
        documents: documents.map((d) => ({
          id: d.id,
          title: d.title,
          sourceType: d.sourceType,
          status: d.status,
          fileName: d.fileName,
          chunks: d._count.chunks,
          createdAt: d.createdAt.toISOString(),
        })),
      };
    },
  }),
];
