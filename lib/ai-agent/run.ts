import OpenAI from "openai";
import { Prisma, type UserRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  executeTool,
  getTool,
  getToolsForGroups,
  serializeToolResult,
} from "@/lib/ai-tools/registry";
import { buildToolPreview } from "@/lib/ai-tools/preview";
import type { ToolContext, ToolGroup, ToolRisk } from "@/lib/ai-tools/types";
import { logAgentAction } from "./audit";
import type { ExecutedToolCall, PendingActionDTO, StreamEvent } from "./events";

const MODEL = "gpt-5-mini";
const MAX_TOOL_ROUNDS = 8;

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export interface AgentUser {
  id: string;
  email: string;
  role: UserRole;
}

interface AccumulatedToolCall {
  id: string;
  name: string;
  args: string;
}

interface RunState {
  chatId: string;
  user: AgentUser;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  executed: ExecutedToolCall[];
  /** Tool groups this run may use. Undefined means every group the role allows. */
  groups?: ToolGroup[];
  send: (event: StreamEvent) => void;
}

/** Both routes stream from here so the pause/resume halves behave identically. */
export interface RunAgentOptions {
  chatId: string;
  user: AgentUser;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  send: (event: StreamEvent) => void;
  executed?: ExecutedToolCall[];
  groups?: ToolGroup[];
}

export async function runAgent(options: RunAgentOptions): Promise<void> {
  const state: RunState = {
    chatId: options.chatId,
    user: options.user,
    messages: options.messages,
    executed: options.executed ?? [],
    groups: options.groups,
    send: options.send,
  };

  await runLoop(state);
}

async function runLoop(state: RunState): Promise<void> {
  const tools = getToolsForGroups(state.groups, state.user.role);
  let content = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    if (round === 0) {
      state.send({ type: "status", message: "Thinking..." });
    }

    const { text, toolCalls } = await streamCompletion(state, tools);
    content += text;

    if (toolCalls.length === 0) {
      await finishRun(state, content);
      return;
    }

    const toolContext: ToolContext = {
      userId: state.user.id,
      userEmail: state.user.email,
      role: state.user.role,
      chatId: state.chatId,
    };

    const readCalls: AccumulatedToolCall[] = [];
    const confirmCalls: AccumulatedToolCall[] = [];

    for (const call of toolCalls) {
      const tool = getTool(call.name);
      if (tool && tool.risk !== "read") {
        confirmCalls.push(call);
      } else {
        readCalls.push(call);
      }
    }

    state.messages.push({
      role: "assistant",
      content: text || null,
      tool_calls: toolCalls.map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.name, arguments: call.args || "{}" },
      })),
    });

    for (const call of readCalls) {
      const result = await executeAndRecord(state, call, toolContext);
      state.messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      });
    }

    if (confirmCalls.length > 0) {
      await pauseForConfirmation(state, confirmCalls, content);
      return;
    }

    state.send({ type: "status", message: "Analyzing results..." });
  }

  await finishRun(state, content || "I stopped after too many tool steps. Please narrow the request.");
}

async function streamCompletion(
  state: RunState,
  tools: OpenAI.Chat.Completions.ChatCompletionTool[]
): Promise<{ text: string; toolCalls: AccumulatedToolCall[] }> {
  const stream = await getOpenAI().chat.completions.create({
    model: MODEL,
    messages: state.messages,
    tools,
    tool_choice: "auto",
    stream: true,
  });

  let text = "";
  const accumulator = new Map<number, AccumulatedToolCall>();

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      text += delta.content;
      state.send({ type: "content", content: delta.content });
    }

    for (const toolCall of delta.tool_calls ?? []) {
      const index = toolCall.index ?? 0;
      const existing = accumulator.get(index) ?? { id: "", name: "", args: "" };

      if (toolCall.id) existing.id = toolCall.id;
      if (toolCall.function?.name) existing.name += toolCall.function.name;
      if (toolCall.function?.arguments) existing.args += toolCall.function.arguments;

      accumulator.set(index, existing);
    }
  }

  const toolCalls = Array.from(accumulator.values()).filter((call) => call.name.length > 0);

  return { text, toolCalls };
}

function parseArgs(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function executeAndRecord(
  state: RunState,
  call: AccumulatedToolCall,
  toolContext: ToolContext
): Promise<string> {
  const tool = getTool(call.name);
  const label = tool?.label ?? call.name;
  const args = parseArgs(call.args);

  state.send({ type: "tool_start", name: call.name, label });
  state.send({ type: "status", message: `Running ${label}...` });

  const result = await executeTool(call.name, args, toolContext);

  state.send({ type: "tool_end", name: call.name, label, ok: result.ok });

  state.executed.push({
    name: call.name,
    label,
    risk: tool?.risk ?? "read",
    args,
    result: result.value,
    ok: result.ok,
  });

  return serializeToolResult(result);
}

/**
 * Persists the mutating calls plus a snapshot of the conversation so the run can be
 * resumed from a separate request once the user decides.
 */
async function pauseForConfirmation(
  state: RunState,
  calls: AccumulatedToolCall[],
  content: string
): Promise<void> {
  console.log(`[AIAgent] pausing for ${calls.length} confirmation(s) in chat ${state.chatId}`);

  const message = await prisma.aIChatMessage.create({
    data: {
      chatId: state.chatId,
      role: "assistant",
      content,
      toolCalls:
        state.executed.length > 0
          ? (toJsonValue(state.executed) as Prisma.InputJsonValue)
          : undefined,
    },
  });

  // The tools run so far belong to the message just saved, so the resumed run
  // starts with an empty list and its own assistant message. The groups travel
  // with it so the resumed turn sees the same tools as the paused one.
  const snapshot = toJsonValue({
    messages: state.messages,
    executed: [],
    groups: state.groups ?? null,
  }) as Prisma.InputJsonValue;

  const actions: PendingActionDTO[] = [];

  for (const call of calls) {
    const tool = getTool(call.name);
    if (!tool) continue;

    const args = parseArgs(call.args);
    const preview = await buildToolPreview(tool, args);

    const pending = await prisma.aIChatPendingAction.create({
      data: {
        chatId: state.chatId,
        messageId: message.id,
        toolName: call.name,
        toolCallId: call.id,
        args: toJsonValue(args) as Prisma.InputJsonValue,
        risk: tool.risk,
        previewTitle: preview.title,
        previewSummary: preview.summary,
        previewDetails: preview.details
          ? (toJsonValue(preview.details) as Prisma.InputJsonValue)
          : undefined,
        conversationSnapshot: snapshot,
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
      isVoice: false,
    });
  }

  await touchChat(state.chatId);

  state.send({ type: "confirmation_required", messageId: message.id, actions });
}

async function finishRun(state: RunState, content: string): Promise<void> {
  const finalContent = content.trim() || "I couldn't generate a response for that.";

  if (!content.trim()) {
    state.send({ type: "content", content: finalContent });
  }

  const message = await prisma.aIChatMessage.create({
    data: {
      chatId: state.chatId,
      role: "assistant",
      content: finalContent,
      toolCalls:
        state.executed.length > 0
          ? (toJsonValue(state.executed) as Prisma.InputJsonValue)
          : undefined,
    },
  });

  await touchChat(state.chatId);

  state.send({ type: "done", messageId: message.id, toolCalls: state.executed });
}

async function touchChat(chatId: string): Promise<void> {
  await prisma.aIChat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
}

function toJsonValue(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return null;
  }
}

export interface PendingSnapshot {
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  executed: ExecutedToolCall[];
  groups?: ToolGroup[];
}

export function parseSnapshot(value: unknown): PendingSnapshot {
  const snapshot = value as Partial<PendingSnapshot> | null;

  return {
    messages: Array.isArray(snapshot?.messages) ? snapshot.messages : [],
    executed: Array.isArray(snapshot?.executed) ? snapshot.executed : [],
    groups: Array.isArray(snapshot?.groups) ? snapshot.groups : undefined,
  };
}

interface ResolvePendingOptions {
  chatId: string;
  user: AgentUser;
  send: (event: StreamEvent) => void;
  pendingActions: Array<{
    id: string;
    toolName: string;
    toolCallId: string;
    args: unknown;
    risk: string;
    approved: boolean;
  }>;
  snapshot: PendingSnapshot;
}

/** Runs the approved tools, records the rejected ones, then continues the loop. */
export async function resumeAgent(options: ResolvePendingOptions): Promise<void> {
  const state: RunState = {
    chatId: options.chatId,
    user: options.user,
    messages: options.snapshot.messages,
    executed: options.snapshot.executed,
    groups: options.snapshot.groups,
    send: options.send,
  };

  const toolContext: ToolContext = {
    userId: options.user.id,
    userEmail: options.user.email,
    role: options.user.role,
    chatId: options.chatId,
  };

  for (const pending of options.pendingActions) {
    const tool = getTool(pending.toolName);
    const label = tool?.label ?? pending.toolName;
    const args = (pending.args ?? {}) as Record<string, unknown>;
    const risk = (tool?.risk ?? pending.risk) as ToolRisk;

    if (!pending.approved) {
      console.log(`[AIAgent] user rejected ${pending.toolName}`);

      state.messages.push({
        role: "tool",
        tool_call_id: pending.toolCallId,
        content: JSON.stringify({
          rejected: true,
          message: "The user rejected this action. It was not performed.",
        }),
      });

      state.executed.push({
        name: pending.toolName,
        label,
        risk,
        args,
        result: { rejected: true },
        ok: false,
        rejected: true,
      });

      await prisma.aIChatPendingAction.update({
        where: { id: pending.id },
        data: { status: "REJECTED", resolvedAt: new Date() },
      });

      await logAgentAction({
        userId: options.user.id,
        chatId: options.chatId,
        toolName: pending.toolName,
        args,
        risk,
        status: "REJECTED",
      });

      continue;
    }

    state.send({ type: "tool_start", name: pending.toolName, label });
    state.send({ type: "status", message: `Running ${label}...` });

    const result = await executeTool(pending.toolName, args, toolContext);

    state.send({ type: "tool_end", name: pending.toolName, label, ok: result.ok });

    state.messages.push({
      role: "tool",
      tool_call_id: pending.toolCallId,
      content: serializeToolResult(result),
    });

    state.executed.push({
      name: pending.toolName,
      label,
      risk,
      args,
      result: result.value,
      ok: result.ok,
    });

    await prisma.aIChatPendingAction.update({
      where: { id: pending.id },
      data: {
        status: result.ok ? "EXECUTED" : "FAILED",
        result: toJsonValue(result.value) as Prisma.InputJsonValue,
        error: result.error ?? null,
        resolvedAt: new Date(),
      },
    });

    await logAgentAction({
      userId: options.user.id,
      chatId: options.chatId,
      toolName: pending.toolName,
      args,
      risk,
      status: result.ok ? "EXECUTED" : "FAILED",
      result: result.value,
      error: result.error ?? null,
    });
  }

  state.send({ type: "status", message: "Applying results..." });

  await runLoop(state);
}

export async function generateChatTitle(firstMessage: string): Promise<string> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "Generate a short title (max 5 words) for a chat that starts with this message. Return only the title, no quotes or punctuation.",
        },
        { role: "user", content: firstMessage },
      ],
      // gpt-5-mini spends completion tokens on reasoning before it writes anything,
      // so the budget has to cover both or the title comes back empty.
      reasoning_effort: "low",
      max_completion_tokens: 500,
    });

    return response.choices[0]?.message?.content?.trim() || "New Chat";
  } catch (error) {
    console.error("[AIAgent] failed to generate chat title:", error);
    return "New Chat";
  }
}
