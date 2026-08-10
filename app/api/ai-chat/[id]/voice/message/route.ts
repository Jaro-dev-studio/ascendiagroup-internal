import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getChatUser } from "@/lib/ai-agent/chat-access";
import { saveVoiceMessage } from "@/lib/ai-agent/voice";
import type { ExecutedToolCall } from "@/lib/ai-agent/events";

export const maxDuration = 30;

/** Stores a spoken turn so the call appears in the chat as ordinary text. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, status, error } = await getChatUser();
    if (!user) {
      return NextResponse.json({ data: null, error: error ?? "Unauthorized" }, { status });
    }

    const { id: chatId } = await params;
    const body = await request.json();

    const role = body?.role;
    const content = body?.content;

    if (role !== "user" && role !== "assistant") {
      return NextResponse.json({ data: null, error: "Invalid role" }, { status: 400 });
    }

    if (typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ data: null, error: "Content is required" }, { status: 400 });
    }

    const chat = await prisma.aIChat.findFirst({
      where: { id: chatId, userId: user.id },
      select: { id: true },
    });

    if (!chat) {
      return NextResponse.json({ data: null, error: "Chat not found" }, { status: 404 });
    }

    const saved = await saveVoiceMessage({
      chatId,
      role,
      content: content.trim(),
      toolCalls: Array.isArray(body?.toolCalls)
        ? (body.toolCalls as ExecutedToolCall[])
        : undefined,
    });

    return NextResponse.json({ data: saved, error: null });
  } catch (error) {
    console.error("[API] ai-chat/[id]/voice/message POST error:", error);
    return NextResponse.json({ data: null, error: "Failed to save the transcript" }, { status: 500 });
  }
}
