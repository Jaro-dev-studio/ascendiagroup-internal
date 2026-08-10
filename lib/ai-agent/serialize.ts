import type { AIChatMessage, AIChatPendingAction } from "@prisma/client";
import { formatToolName } from "@/lib/ai-tools/registry";
import type { PendingActionDTO } from "./events";
import { isVoicePendingAction } from "./voice";

export interface ChatMessageDTO {
  id: string;
  role: string;
  content: string;
  toolCalls: unknown;
  pendingActions: PendingActionDTO[];
  createdAt: string;
}

export function serializePendingAction(action: AIChatPendingAction): PendingActionDTO {
  return {
    id: action.id,
    toolName: action.toolName,
    label: formatToolName(action.toolName),
    risk: action.risk === "destructive" ? "destructive" : "additive",
    title: action.previewTitle,
    summary: action.previewSummary,
    details: (action.previewDetails as Record<string, unknown> | null) ?? null,
    status: action.status as PendingActionDTO["status"],
    isVoice: isVoicePendingAction(action.conversationSnapshot),
  };
}

export function serializeChatMessages(
  messages: Array<AIChatMessage & { pendingActions?: AIChatPendingAction[] }>
): ChatMessageDTO[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    toolCalls: message.toolCalls,
    pendingActions: (message.pendingActions ?? []).map(serializePendingAction),
    createdAt: message.createdAt.toISOString(),
  }));
}
