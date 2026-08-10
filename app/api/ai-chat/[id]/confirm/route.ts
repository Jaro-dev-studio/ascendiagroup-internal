import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getChatUser } from "@/lib/ai-agent/chat-access";
import { parseSnapshot, resumeAgent } from "@/lib/ai-agent/run";
import { encodeStreamEvent, SSE_HEADERS, type StreamEvent } from "@/lib/ai-agent/events";

export const maxDuration = 60;

interface Decision {
  pendingActionId: string;
  approved: boolean;
}

function errorResponse(message: string, status: number): Response {
  return new Response(encodeStreamEvent({ type: "error", message }), {
    status,
    headers: SSE_HEADERS,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, status, error } = await getChatUser();
    if (!user) return errorResponse(error ?? "Unauthorized", status);

    const { id: chatId } = await params;
    const body = await request.json();
    const decisions = body?.decisions as Decision[] | undefined;

    if (!Array.isArray(decisions) || decisions.length === 0) {
      return errorResponse("Decisions are required", 400);
    }

    const chat = await prisma.aIChat.findFirst({
      where: { id: chatId, userId: user.id },
      select: { id: true },
    });

    if (!chat) return errorResponse("Chat not found", 404);

    const pendingRows = await prisma.aIChatPendingAction.findMany({
      where: {
        id: { in: decisions.map((d) => d.pendingActionId) },
        chatId,
        status: "PENDING",
      },
      orderBy: { createdAt: "asc" },
    });

    if (pendingRows.length === 0) {
      return errorResponse("These actions have already been resolved", 409);
    }

    const approvals = new Map(decisions.map((d) => [d.pendingActionId, Boolean(d.approved)]));
    const snapshot = parseSnapshot(pendingRows[0].conversationSnapshot);

    if (snapshot.messages.length === 0) {
      return errorResponse("The original conversation could not be restored", 410);
    }

    console.log(
      `[AIAgent] resolving ${pendingRows.length} pending action(s) in chat ${chatId}`
    );

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const send = (event: StreamEvent) => {
          if (closed) return;
          controller.enqueue(encoder.encode(encodeStreamEvent(event)));
        };

        try {
          await resumeAgent({
            chatId,
            user,
            send,
            snapshot,
            pendingActions: pendingRows.map((row) => ({
              id: row.id,
              toolName: row.toolName,
              toolCallId: row.toolCallId,
              args: row.args,
              risk: row.risk,
              approved: approvals.get(row.id) ?? false,
            })),
          });
        } catch (streamError) {
          console.error("[AIAgent] confirm stream error:", streamError);
          send({ type: "error", message: "Failed to apply the confirmed actions" });
        } finally {
          closed = true;
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    console.error("[API] ai-chat/[id]/confirm POST error:", error);
    return errorResponse("Failed to apply the confirmed actions", 500);
  }
}
