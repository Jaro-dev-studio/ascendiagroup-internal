export type ToolRisk = "read" | "additive" | "destructive";

export type PendingActionStatus = "PENDING" | "REJECTED" | "EXECUTED" | "FAILED";

export interface PendingAction {
  id: string;
  toolName: string;
  label: string;
  risk: Exclude<ToolRisk, "read">;
  title: string;
  summary: string;
  details: Record<string, unknown> | null;
  status: PendingActionStatus;
  /** Raised during a voice call, so approving it resolves through that session. */
  isVoice?: boolean;
}

export interface ExecutedToolCall {
  name: string;
  label: string;
  risk: ToolRisk;
  args: unknown;
  result: unknown;
  ok: boolean;
  rejected?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ExecutedToolCall[] | null;
  pendingActions?: PendingAction[];
  createdAt: string;
  /** Speech still being transcribed, drawn provisionally until the turn lands. */
  isDraft?: boolean;
}

export interface ChatSummary {
  id: string;
  title: string;
  lastMessage: string | null;
  updatedAt: string;
  messages?: ChatMessage[] | null;
}
