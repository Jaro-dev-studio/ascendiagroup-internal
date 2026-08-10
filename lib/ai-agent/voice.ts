import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { executeTool, getTool, serializeToolResult } from "@/lib/ai-tools/registry";
import { buildToolPreview } from "@/lib/ai-tools/preview";
import type { ToolContext, ToolRisk } from "@/lib/ai-tools/types";
import { logAgentAction } from "./audit";
import { generateChatTitle, type AgentUser } from "./run";
import type { ExecutedToolCall, PendingActionDTO } from "./events";

/**
 * A paused text turn stores the OpenAI message array so a later request can
 * resume the loop. A voice turn has nothing to resume: the conversation lives in
 * the realtime session, so the snapshot only records where the action came from
 * and the browser feeds the outcome back over the data channel.
 */
const VOICE_SNAPSHOT = { voice: true } as const;

export function isVoicePendingAction(snapshot: unknown): boolean {
  return (snapshot as { voice?: unknown } | null)?.voice === true;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  } catch {
    return {} as Prisma.InputJsonValue;
  }
}

async function touchChat(chatId: string): Promise<void> {
  await prisma.aIChat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
}

export interface VoiceToolCall {
  callId: string;
  name: string;
  args: Record<string, unknown>;
}

/** One answer for the realtime session plus the record the chat UI renders. */
export interface VoiceToolOutput {
  callId: string;
  output: string;
  executed: ExecutedToolCall;
}

export interface VoiceToolBatch {
  /** Read tools, already run, ready to hand back to the model. */
  completed: VoiceToolOutput[];
  /** Mutating tools waiting on the user, attached to a message of their own. */
  pending: {
    messageId: string;
    actions: PendingActionDTO[];
    /** Realtime still needs an answer for each paused call before it can speak. */
    callIds: string[];
  } | null;
}

/**
 * Runs a turn's tool calls with the same rules as the text agent: read tools go
 * straight through, anything that changes data is parked behind an approval card.
 */
export async function runVoiceToolCalls(options: {
  chatId: string;
  user: AgentUser;
  calls: VoiceToolCall[];
}): Promise<VoiceToolBatch> {
  const { chatId, user, calls } = options;

  const toolContext: ToolContext = {
    userId: user.id,
    userEmail: user.email,
    role: user.role,
    chatId,
  };

  const readCalls = calls.filter((call) => (getTool(call.name)?.risk ?? "read") === "read");
  const confirmCalls = calls.filter((call) => (getTool(call.name)?.risk ?? "read") !== "read");

  console.log(
    `[AIVoice] tool batch in chat ${chatId}: ${readCalls.length} read, ${confirmCalls.length} awaiting approval`
  );

  const completed: VoiceToolOutput[] = [];

  for (const call of readCalls) {
    const tool = getTool(call.name);
    const label = tool?.label ?? call.name;
    const result = await executeTool(call.name, call.args, toolContext);

    completed.push({
      callId: call.callId,
      output: serializeToolResult(result),
      executed: {
        name: call.name,
        label,
        risk: tool?.risk ?? "read",
        args: call.args,
        result: result.value,
        ok: result.ok,
      },
    });
  }

  if (confirmCalls.length === 0) {
    return { completed, pending: null };
  }

  // The cards hang off a message of their own so they survive a reload, and so the
  // spoken sentence about them stays a separate transcript entry.
  const message = await prisma.aIChatMessage.create({
    data: { chatId, role: "assistant", content: "" },
  });

  const actions: PendingActionDTO[] = [];
  const callIds: string[] = [];

  for (const call of confirmCalls) {
    const tool = getTool(call.name);
    if (!tool) continue;

    const preview = await buildToolPreview(tool, call.args);

    const pending = await prisma.aIChatPendingAction.create({
      data: {
        chatId,
        messageId: message.id,
        toolName: call.name,
        toolCallId: call.callId,
        args: toJsonValue(call.args),
        risk: tool.risk,
        previewTitle: preview.title,
        previewSummary: preview.summary,
        previewDetails: preview.details ? toJsonValue(preview.details) : undefined,
        conversationSnapshot: toJsonValue(VOICE_SNAPSHOT),
      },
    });

    actions.push({
      id: pending.id,
      toolName: call.name,
      label: tool.label,
      risk: tool.risk as Exclude<ToolRisk, "read">,
      title: preview.title,
      summary: preview.summary,
      details: preview.details ?? null,
      status: "PENDING",
      isVoice: true,
    });

    callIds.push(call.callId);
  }

  await touchChat(chatId);

  return { completed, pending: { messageId: message.id, actions, callIds } };
}

export interface VoiceDecision {
  pendingActionId: string;
  approved: boolean;
}

export interface VoiceResolution {
  pendingActionId: string;
  toolCallId: string;
  status: "EXECUTED" | "REJECTED" | "FAILED";
  /** Spoken-language summary the realtime session is told about. */
  note: string;
  executed: ExecutedToolCall;
}

/**
 * Applies the user's decisions and reports back what happened. The realtime
 * session already answered the paused calls, so the outcome is returned as notes
 * the browser injects as a fresh conversation item instead of a tool result.
 */
export async function resolveVoiceActions(options: {
  chatId: string;
  user: AgentUser;
  decisions: VoiceDecision[];
}): Promise<VoiceResolution[]> {
  const { chatId, user, decisions } = options;

  const rows = await prisma.aIChatPendingAction.findMany({
    where: {
      id: { in: decisions.map((decision) => decision.pendingActionId) },
      chatId,
      status: "PENDING",
    },
    orderBy: { createdAt: "asc" },
  });

  if (rows.length === 0) return [];

  const approvals = new Map(
    decisions.map((decision) => [decision.pendingActionId, Boolean(decision.approved)])
  );

  const toolContext: ToolContext = {
    userId: user.id,
    userEmail: user.email,
    role: user.role,
    chatId,
  };

  const resolutions: VoiceResolution[] = [];

  for (const row of rows) {
    const tool = getTool(row.toolName);
    const label = tool?.label ?? row.toolName;
    const args = (row.args ?? {}) as Record<string, unknown>;
    const risk = (tool?.risk ?? row.risk) as ToolRisk;
    const approved = approvals.get(row.id) ?? false;

    if (!approved) {
      console.log(`[AIVoice] user rejected ${row.toolName} in chat ${chatId}`);

      await prisma.aIChatPendingAction.update({
        where: { id: row.id },
        data: { status: "REJECTED", resolvedAt: new Date() },
      });

      await logAgentAction({
        userId: user.id,
        chatId,
        toolName: row.toolName,
        args,
        risk,
        status: "REJECTED",
      });

      resolutions.push({
        pendingActionId: row.id,
        toolCallId: row.toolCallId,
        status: "REJECTED",
        note: `The user rejected "${label}". It was not performed. Acknowledge it briefly and do not retry the same call.`,
        executed: {
          name: row.toolName,
          label,
          risk,
          args,
          result: { rejected: true },
          ok: false,
          rejected: true,
        },
      });

      continue;
    }

    const result = await executeTool(row.toolName, args, toolContext);
    const status = result.ok ? "EXECUTED" : "FAILED";

    await prisma.aIChatPendingAction.update({
      where: { id: row.id },
      data: {
        status,
        result: toJsonValue(result.value),
        error: result.error ?? null,
        resolvedAt: new Date(),
      },
    });

    await logAgentAction({
      userId: user.id,
      chatId,
      toolName: row.toolName,
      args,
      risk,
      status,
      result: result.value,
      error: result.error ?? null,
    });

    resolutions.push({
      pendingActionId: row.id,
      toolCallId: row.toolCallId,
      status,
      note: result.ok
        ? `The user approved "${label}" and it ran successfully. Result: ${serializeToolResult(result)}`
        : `The user approved "${label}" but it failed: ${result.error ?? "unknown error"}. Explain what went wrong.`,
      executed: {
        name: row.toolName,
        label,
        risk,
        args,
        result: result.value,
        ok: result.ok,
      },
    });
  }

  await attachToolCalls(rows[0].messageId, resolutions.map((entry) => entry.executed));
  await touchChat(chatId);

  return resolutions;
}

/** Keeps the reloaded transcript in step with what the cards ended up doing. */
async function attachToolCalls(
  messageId: string | null,
  executed: ExecutedToolCall[]
): Promise<void> {
  if (!messageId || executed.length === 0) return;

  const message = await prisma.aIChatMessage.findUnique({
    where: { id: messageId },
    select: { toolCalls: true },
  });

  if (!message) return;

  const existing = Array.isArray(message.toolCalls)
    ? (message.toolCalls as unknown as ExecutedToolCall[])
    : [];

  await prisma.aIChatMessage.update({
    where: { id: messageId },
    data: { toolCalls: toJsonValue([...existing, ...executed]) },
  });
}

export interface SavedVoiceMessage {
  id: string;
  createdAt: string;
  /** Set only when this message triggered the chat's first title. */
  title: string | null;
}

/**
 * Persists one side of a spoken turn so the call reads back as an ordinary chat
 * and the text agent picks up the same history on the next typed message.
 */
export async function saveVoiceMessage(options: {
  chatId: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ExecutedToolCall[];
}): Promise<SavedVoiceMessage> {
  const { chatId, role, content, toolCalls } = options;

  const isFirstMessage = (await prisma.aIChatMessage.count({ where: { chatId } })) === 0;

  const message = await prisma.aIChatMessage.create({
    data: {
      chatId,
      role,
      content,
      toolCalls: toolCalls && toolCalls.length > 0 ? toJsonValue(toolCalls) : undefined,
    },
  });

  let title: string | null = null;

  if (isFirstMessage && role === "user") {
    title = await generateChatTitle(content);
    await prisma.aIChat.update({ where: { id: chatId }, data: { title } });
  } else {
    await touchChat(chatId);
  }

  return { id: message.id, createdAt: message.createdAt.toISOString(), title };
}

export interface VoiceHistoryItem {
  role: "user" | "assistant";
  content: string;
}

const HISTORY_TURNS = 20;
const HISTORY_CHARS = 1200;

/** Recent chat replayed into the session so a call continues where typing left off. */
export function buildVoiceHistory(
  messages: Array<{ role: string; content: string }>
): VoiceHistoryItem[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .filter((message) => message.content.trim().length > 0)
    .slice(-HISTORY_TURNS)
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content.slice(0, HISTORY_CHARS),
    }));
}
