import type { ToolRisk } from "@/lib/ai-tools/types";

export interface ExecutedToolCall {
  name: string;
  label: string;
  risk: ToolRisk;
  args: unknown;
  result: unknown;
  ok: boolean;
  rejected?: boolean;
}

export interface PendingActionDTO {
  id: string;
  toolName: string;
  label: string;
  risk: Exclude<ToolRisk, "read">;
  title: string;
  summary: string;
  details: Record<string, unknown> | null;
  status: "PENDING" | "REJECTED" | "EXECUTED" | "FAILED";
  /** Voice actions resolve through the realtime session instead of the agent loop. */
  isVoice: boolean;
}

export type StreamEvent =
  | { type: "status"; message: string }
  | { type: "title"; title: string }
  | { type: "tool_start"; name: string; label: string }
  | { type: "tool_end"; name: string; label: string; ok: boolean }
  | { type: "content"; content: string }
  | { type: "confirmation_required"; messageId: string; actions: PendingActionDTO[] }
  | { type: "done"; messageId: string | null; toolCalls: ExecutedToolCall[] }
  | { type: "error"; message: string };

export function encodeStreamEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;
