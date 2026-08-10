import {
  createManualDocument,
  deleteDocument,
  retryProcessDocument,
} from "@/lib/actions/knowledge-base";
import { defineTool, type AITool } from "../types";
import { lookupEntityLabel } from "../preview";
import { deletePreview, unwrapAction } from "./helpers";

export const knowledgeBaseWriteTools: AITool[] = [
  defineTool({
    name: "createKnowledgeBaseDocument",
    label: "Create Knowledge Base Document",
    risk: "additive",
    description:
      "Add a document to the knowledge base. The content is chunked and embedded so it becomes searchable.",
    parameters: {
      properties: {
        title: { type: "string", description: "Document title" },
        htmlContent: { type: "string", description: "Document body as HTML" },
      },
      required: ["title", "htmlContent"],
    },
    preview: async (args) => {
      const content = String(args.htmlContent);
      return {
        title: "Create knowledge base document",
        summary: `"${args.title}" (${content.length} characters) will be embedded and made searchable.`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        createManualDocument(args.title as string, args.htmlContent as string)
      ),
  }),

  defineTool({
    name: "deleteKnowledgeBaseDocument",
    label: "Delete Knowledge Base Document",
    risk: "destructive",
    description:
      "Permanently delete a knowledge base document, its embeddings, and its uploaded file.",
    parameters: {
      properties: { documentId: { type: "string", description: "The document ID" } },
      required: ["documentId"],
    },
    preview: deletePreview("knowledgeBaseDocument", "documentId", "knowledge base document"),
    execute: async (args) => unwrapAction(deleteDocument(args.documentId as string)),
  }),

  defineTool({
    name: "retryKnowledgeBaseDocument",
    label: "Reprocess Knowledge Base Document",
    risk: "additive",
    description:
      "Delete a document's existing chunks and re-run embedding. Use this for documents stuck in FAILED.",
    parameters: {
      properties: { documentId: { type: "string", description: "The document ID" } },
      required: ["documentId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel(
        "knowledgeBaseDocument",
        String(args.documentId)
      );
      return {
        title: "Reprocess knowledge base document",
        summary: `Existing chunks for ${label ? `"${label}"` : String(args.documentId)} will be deleted and re-embedded.`,
      };
    },
    execute: async (args) => unwrapAction(retryProcessDocument(args.documentId as string)),
  }),
];
