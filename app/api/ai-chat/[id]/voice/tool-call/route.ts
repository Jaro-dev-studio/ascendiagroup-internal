import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getChatUser } from "@/lib/ai-agent/chat-access";
import { runVoiceToolCalls, type VoiceToolCall } from "@/lib/ai-agent/voice";

export const maxDuration = 60;

function parseCalls(value: unknown): VoiceToolCall[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    const call = entry as { callId?: unknown; name?: unknown; args?: unknown };
    if (typeof call.callId !== "string" || typeof call.name !== "string") return [];

    return [
      {
        callId: call.callId,
        name: call.name,
        args:
          typeof call.args === "object" && call.args !== null
            ? (call.args as Record<string, unknown>)
            : {},
      },
    ];
  });
}

/** Runs the tool calls the realtime model asked for during a spoken turn. */
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
    const calls = parseCalls(body?.calls);

    if (calls.length === 0) {
      return NextResponse.json({ data: null, error: "Tool calls are required" }, { status: 400 });
    }

    const chat = await prisma.aIChat.findFirst({
      where: { id: chatId, userId: user.id },
      select: { id: true },
    });

    if (!chat) {
      return NextResponse.json({ data: null, error: "Chat not found" }, { status: 404 });
    }

    const result = await runVoiceToolCalls({ chatId, user, calls });

    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error("[API] ai-chat/[id]/voice/tool-call POST error:", error);
    return NextResponse.json({ data: null, error: "Failed to run the tool" }, { status: 500 });
  }
}
