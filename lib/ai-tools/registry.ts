import type OpenAI from "openai";
import type { UserRole } from "@prisma/client";

import { taskReadTools } from "./read/tasks";
import { actionItemReadTools } from "./read/action-items";
import { requestReadTools } from "./read/requests";
import { clientReadTools } from "./read/clients";
import { userReadTools } from "./read/users";
import { marketingReadTools } from "./read/marketing";
import { callReadTools } from "./read/calls";
import { knowledgeBaseReadTools } from "./read/knowledge-base";
import { deliveryReadTools } from "./read/delivery";
import { salesReadTools } from "./read/sales";
import { govReadTools } from "./read/gov";
import { crmReadTools } from "./read/crm";
import { sequenceReadTools } from "./read/sequences";
import { recordingReadTools } from "./read/recording";
import { pageAccessReadTools } from "./read/page-access";
import { webReadTools } from "./read/web";

import { taskWriteTools } from "./write/tasks";
import { actionItemWriteTools } from "./write/action-items";
import { requestWriteTools } from "./write/requests";
import { clientWriteTools } from "./write/clients";
import { userWriteTools } from "./write/users";
import { contentWriteTools } from "./write/content";
import { demoWriteTools } from "./write/demos";
import { workflowWriteTools } from "./write/workflows";
import { knowledgeBaseWriteTools } from "./write/knowledge-base";
import { followupWriteTools } from "./write/followups";
import { adWriteTools } from "./write/ads";
import { govWriteTools } from "./write/gov";
import { salesMapWriteTools } from "./write/sales-maps";
import { meetingWriteTools } from "./write/meetings";
import { crmWriteTools } from "./write/crm";
import { sequenceWriteTools } from "./write/sequences";
import { pageAccessWriteTools } from "./write/page-access";

import type { AITool, ToolArgs, ToolContext, ToolGroup } from "./types";

/**
 * Every tool belongs to exactly one group. `core` covers the lookups the model
 * needs in almost any conversation (clients, users, knowledge base and web
 * search) and is never dropped from a request.
 */
const TOOL_GROUPS: Record<ToolGroup, AITool[]> = {
  core: [...clientReadTools, ...userReadTools, ...knowledgeBaseReadTools, ...webReadTools],

  crm: [...crmReadTools, ...crmWriteTools],

  sequences: [...sequenceReadTools, ...sequenceWriteTools],

  meetings: [
    ...callReadTools,
    ...recordingReadTools,
    ...meetingWriteTools,
    ...followupWriteTools,
  ],

  delivery: [
    ...taskReadTools,
    ...actionItemReadTools,
    ...requestReadTools,
    ...taskWriteTools,
    ...actionItemWriteTools,
    ...requestWriteTools,
    ...workflowWriteTools,
  ],

  clients: [...clientWriteTools],

  marketing: [...marketingReadTools, ...contentWriteTools, ...adWriteTools],

  sales: [...salesReadTools, ...deliveryReadTools, ...salesMapWriteTools, ...demoWriteTools],

  gov: [...govReadTools, ...govWriteTools],

  admin: [...userWriteTools, ...pageAccessReadTools, ...pageAccessWriteTools],

  knowledge: [...knowledgeBaseWriteTools],
};

const GROUP_NAMES = Object.keys(TOOL_GROUPS) as ToolGroup[];

/**
 * Order groups are dropped in when a request exceeds the tool limit. Groups the
 * router selected are always kept; this only decides which unselected group goes
 * first. `core` is absent because it is never dropped.
 */
const SHED_ORDER: ToolGroup[] = [
  "gov",
  "marketing",
  "sales",
  "sequences",
  "meetings",
  "delivery",
  "admin",
  "knowledge",
  "clients",
  "crm",
];

const ALL_TOOLS: AITool[] = GROUP_NAMES.flatMap((group) => TOOL_GROUPS[group]);

const TOOL_MAP = new Map<string, AITool>(ALL_TOOLS.map((tool) => [tool.name, tool]));

const GROUP_BY_TOOL = new Map<string, ToolGroup>(
  GROUP_NAMES.flatMap((group) => TOOL_GROUPS[group].map((tool) => [tool.name, group] as const))
);

export function getTool(name: string): AITool | undefined {
  return TOOL_MAP.get(name);
}

export function getToolGroup(name: string): ToolGroup | undefined {
  return GROUP_BY_TOOL.get(name);
}

export function getAllToolGroups(): ToolGroup[] {
  return [...GROUP_NAMES];
}

export function canUseTool(tool: AITool, role: UserRole): boolean {
  if (role === "CLIENT") return false;
  if (tool.adminOnly) return role === "ADMIN";
  return true;
}

/** OpenAI rejects a request carrying more than 128 function definitions. */
const MAX_TOOLS_PER_REQUEST = 128;

/**
 * Builds the tool list for a request. Starts from everything the role may use and
 * drops groups the router did not select until the list fits, so a wrong routing
 * decision degrades gracefully instead of hiding a whole domain.
 */
export function getToolsForGroups(
  groups: ToolGroup[] | undefined,
  role: UserRole
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  const selected = new Set<ToolGroup>(groups ?? GROUP_NAMES);
  selected.add("core");

  const kept = new Set<ToolGroup>(GROUP_NAMES);
  let available = ALL_TOOLS.filter((tool) => canUseTool(tool, role));

  for (const group of SHED_ORDER) {
    if (available.length <= MAX_TOOLS_PER_REQUEST) break;
    if (selected.has(group)) continue;

    kept.delete(group);
    available = available.filter((tool) => kept.has(GROUP_BY_TOOL.get(tool.name) as ToolGroup));
  }

  if (available.length > MAX_TOOLS_PER_REQUEST) {
    console.warn(
      `[AITools] ${available.length} tools still registered for ${role} after shedding, truncating to ${MAX_TOOLS_PER_REQUEST}`
    );
  }

  return available.slice(0, MAX_TOOLS_PER_REQUEST).map((tool) => tool.definition);
}

export function getToolsForRole(role: UserRole): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return getToolsForGroups(undefined, role);
}

/**
 * Every tool the role may use, with no per-request ceiling applied. Only for
 * transports without the 128 function limit, such as the realtime voice session.
 */
export function getAllToolDefinitions(
  role: UserRole
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return ALL_TOOLS.filter((tool) => canUseTool(tool, role)).map((tool) => tool.definition);
}

/** Group sizes for the given role, used by the router prompt and diagnostics. */
export function getGroupToolCounts(role: UserRole): Record<ToolGroup, number> {
  return Object.fromEntries(
    GROUP_NAMES.map((group) => [
      group,
      TOOL_GROUPS[group].filter((tool) => canUseTool(tool, role)).length,
    ])
  ) as Record<ToolGroup, number>;
}

export function formatToolName(name: string): string {
  return TOOL_MAP.get(name)?.label ?? name;
}

export function getToolRisk(name: string): AITool["risk"] {
  return TOOL_MAP.get(name)?.risk ?? "read";
}

export interface ToolExecutionResult {
  ok: boolean;
  value: unknown;
  error?: string;
}

/**
 * Executes a tool and normalizes the outcome. Access is re-checked here because
 * several of the underlying server actions carry no role gate of their own.
 */
export async function executeTool(
  name: string,
  args: ToolArgs,
  ctx: ToolContext
): Promise<ToolExecutionResult> {
  const tool = getTool(name);

  if (!tool) {
    return { ok: false, value: { error: `Unknown tool: ${name}` }, error: `Unknown tool: ${name}` };
  }

  if (!canUseTool(tool, ctx.role)) {
    const error = `Access denied: ${tool.label} requires an admin account.`;
    console.log(`[AITools] blocked ${name} for role ${ctx.role}`);
    return { ok: false, value: { error }, error };
  }

  try {
    console.log(`[AITools] executing ${name} (${tool.risk})`);
    const value = await tool.execute(args, ctx);
    return { ok: true, value };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool execution failed";
    console.error(`[AITools] error executing ${name}:`, error);
    return { ok: false, value: { error: message }, error: message };
  }
}

export function serializeToolResult(result: ToolExecutionResult): string {
  try {
    return JSON.stringify(result.value ?? {});
  } catch {
    return JSON.stringify({ error: "Tool result could not be serialized" });
  }
}
