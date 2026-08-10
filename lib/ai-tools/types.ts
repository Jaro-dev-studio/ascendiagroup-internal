import type OpenAI from "openai";
import type { UserRole } from "@prisma/client";

/**
 * read         - executed immediately, no confirmation
 * additive     - creates or updates data, requires user confirmation
 * destructive  - deletes data or triggers irreversible external side effects,
 *                requires user confirmation
 */
export type ToolRisk = "read" | "additive" | "destructive";

/**
 * Tools are bundled into groups so a single request can carry only the groups
 * relevant to the conversation. OpenAI rejects more than 128 function
 * definitions and the full registry is larger than that.
 */
export type ToolGroup =
  | "core"
  | "crm"
  | "sequences"
  | "meetings"
  | "delivery"
  | "clients"
  | "marketing"
  | "sales"
  | "gov"
  | "admin"
  | "knowledge";

export interface ToolContext {
  userId: string;
  userEmail: string;
  role: UserRole;
  chatId: string;
}

export interface ToolPreview {
  title: string;
  summary: string;
  details?: Record<string, unknown>;
}

export type ToolArgs = Record<string, unknown>;

export interface AITool {
  name: string;
  label: string;
  risk: ToolRisk;
  adminOnly: boolean;
  definition: OpenAI.Chat.Completions.ChatCompletionTool;
  execute: (args: ToolArgs, ctx: ToolContext) => Promise<unknown>;
  preview?: (args: ToolArgs) => Promise<ToolPreview>;
}

interface DefineToolOptions {
  name: string;
  label: string;
  description: string;
  risk: ToolRisk;
  /** Defaults to true for any non-read tool. */
  adminOnly?: boolean;
  parameters?: {
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: ToolArgs, ctx: ToolContext) => Promise<unknown>;
  preview?: (args: ToolArgs) => Promise<ToolPreview>;
}

export function defineTool(options: DefineToolOptions): AITool {
  const { properties = {}, required = [] } = options.parameters ?? {};

  return {
    name: options.name,
    label: options.label,
    risk: options.risk,
    adminOnly: options.adminOnly ?? options.risk !== "read",
    definition: {
      type: "function",
      function: {
        name: options.name,
        description: options.description,
        parameters: {
          type: "object",
          properties,
          ...(required.length > 0 ? { required } : {}),
        },
      },
    },
    execute: options.execute,
    preview: options.preview,
  };
}
