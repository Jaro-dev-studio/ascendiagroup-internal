import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getChatUser } from "@/lib/ai-agent/chat-access";
import { resolveVoiceActions, type VoiceDecision } from "@/lib/ai-agent/voice";

export const maxDuration = 60;

function parseDecisions(value: unknown): VoiceDecision[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    const decision = entry as { pendingActionId?: unknown; approved?: unknown };
    if (typeof decision.pendingActionId !== "string") return [];
    return [{ pendingActionId: decision.pendingActionId, approved: Boolean(decision.approved) }];
  });
}

/** Applies approvals raised during a call and reports the outcome back. */
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
    const decisions = parseDecisions(body?.decisions);

    if (decisions.length === 0) {
      return NextResponse.json({ data: null, error: "Decisions are required" }, { status: 400 });
    }

    const chat = await prisma.aIChat.findFirst({
      where: { id: chatId, userId: user.id },
      select: { id: true },
    });

    if (!chat) {
      return NextResponse.json({ data: null, error: "Chat not found" }, { status: 404 });
    }

    const resolutions = await resolveVoiceActions({ chatId, user, decisions });

    if (resolutions.length === 0) {
      return NextResponse.json(
        { data: null, error: "These actions have already been resolved" },
        { status: 409 }
      );
    }

    return NextResponse.json({ data: { resolutions }, error: null });
  } catch (error) {
    console.error("[API] ai-chat/[id]/voice/resolve POST error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to apply the confirmed actions" },
      { status: 500 }
    );
  }
}
