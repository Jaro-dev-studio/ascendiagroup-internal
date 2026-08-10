import { NextRequest } from "next/server";
import OpenAI from "openai";
import prisma from "@/lib/prisma";
import { getChatUser } from "@/lib/ai-agent/chat-access";
import { buildSystemPrompt } from "@/lib/ai-agent/system-prompt";
import { generateChatTitle, runAgent } from "@/lib/ai-agent/run";
import { selectToolGroups } from "@/lib/ai-agent/tool-router";
import { encodeStreamEvent, SSE_HEADERS, type StreamEvent } from "@/lib/ai-agent/events";

export const maxDuration = 60;

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
    const message = body?.message;

    if (!message || typeof message !== "string") {
      return errorResponse("Message is required", 400);
    }

    const chat = await prisma.aIChat.findFirst({
      where: { id: chatId, userId: user.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!chat) return errorResponse("Chat not found", 404);

    console.log(`[AIAgent] new message in chat ${chatId} from ${user.email}`);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const send = (event: StreamEvent) => {
          if (closed) return;
          controller.enqueue(encoder.encode(encodeStreamEvent(event)));
        };

        try {
          await prisma.aIChatMessage.create({
            data: { chatId, role: "user", content: message },
          });

          if (chat.messages.length === 0) {
            const title = await generateChatTitle(message);
            await prisma.aIChat.update({ where: { id: chatId }, data: { title } });
            send({ type: "title", title });
          }

          const history: OpenAI.Chat.ChatCompletionMessageParam[] = chat.messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .filter((m) => m.content.trim().length > 0)
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }));

          const groups = await selectToolGroups({
            message,
            recentMessages: history.map((entry) => ({
              role: entry.role,
              content: typeof entry.content === "string" ? entry.content : "",
            })),
            role: user.role,
          });

          await runAgent({
            chatId,
            user,
            send,
            groups,
            messages: [
              { role: "system", content: buildSystemPrompt(user.role) },
              ...history,
              { role: "user", content: message },
            ],
          });
        } catch (streamError) {
          console.error("[AIAgent] message stream error:", streamError);
          send({ type: "error", message: "Failed to process message" });
        } finally {
          closed = true;
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    console.error("[API] ai-chat/[id]/message POST error:", error);
    return errorResponse("Failed to process message", 500);
  }
}
