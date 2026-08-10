import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getChatUser } from "@/lib/ai-agent/chat-access";
import {
  buildVoiceInstructions,
  createVoiceSession,
  getRealtimeTools,
} from "@/lib/ai-agent/realtime";
import { buildVoiceHistory } from "@/lib/ai-agent/voice";

export const maxDuration = 60;

/** Mints an ephemeral realtime credential for one voice call in this chat. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, status, error } = await getChatUser();
    if (!user) {
      return NextResponse.json({ data: null, error: error ?? "Unauthorized" }, { status });
    }

    const { id: chatId } = await params;

    const chat = await prisma.aIChat.findFirst({
      where: { id: chatId, userId: user.id },
      select: {
        id: true,
        messages: {
          orderBy: { createdAt: "asc" },
          select: { role: true, content: true },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ data: null, error: "Chat not found" }, { status: 404 });
    }

    console.log(`[AIVoice] starting voice session in chat ${chatId} for ${user.email}`);

    const tools = getRealtimeTools(user.role);

    const credentials = await createVoiceSession({
      instructions: buildVoiceInstructions(user.role),
      tools,
    });

    return NextResponse.json({
      data: {
        ...credentials,
        toolCount: tools.length,
        history: buildVoiceHistory(chat.messages),
      },
      error: null,
    });
  } catch (error) {
    console.error("[API] ai-chat/[id]/voice/session POST error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to start the voice session";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
