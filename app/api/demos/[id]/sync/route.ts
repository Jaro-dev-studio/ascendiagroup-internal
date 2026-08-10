import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkCursorAgentStatus } from "@/lib/actions";

/**
 * POST endpoint to manually sync demo status by polling Cursor agent
 * Useful as a fallback if webhooks aren't working
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const demo = await prisma.demo.findUnique({
      where: { id },
    });

    if (!demo) {
      return NextResponse.json(
        { data: null, error: "Demo not found" },
        { status: 404 }
      );
    }

    // Only sync if demo is in generating state and has a cursor agent ID
    if (demo.status !== "generating" || !demo.cursorAgentId) {
      return NextResponse.json({
        data: {
          id: demo.id,
          status: demo.status,
          message: "Demo is not in generating state or has no agent ID",
        },
        error: null,
      });
    }

    // Check Cursor agent status
    const { data: agentStatus, error: agentError } = await checkCursorAgentStatus(
      demo.cursorAgentId
    );

    if (agentError) {
      return NextResponse.json({
        data: null,
        error: agentError,
      });
    }

    if (!agentStatus) {
      return NextResponse.json({
        data: null,
        error: "Failed to get agent status",
      });
    }

    // Update demo status based on agent status
    // Cursor status values: CREATING, RUNNING, FINISHED, ERROR, STOPPED
    let newStatus = demo.status;
    let errorMessage = demo.errorMessage;

    if (agentStatus.status === "FINISHED") {
      newStatus = "deploying";
      errorMessage = null;
    } else if (agentStatus.status === "ERROR" || agentStatus.status === "STOPPED") {
      newStatus = "failed";
      errorMessage = agentStatus.summary || "Cursor agent failed";
    }
    // CREATING and RUNNING mean still in progress - no change

    // Always update the cursor agent status
    await prisma.demo.update({
      where: { id },
      data: {
        status: newStatus,
        cursorAgentStatus: agentStatus.status,
        errorMessage,
      },
    });

    return NextResponse.json({
      data: {
        id: demo.id,
        previousStatus: demo.status,
        newStatus,
        cursorAgentStatus: agentStatus.status,
        summary: agentStatus.summary,
      },
      error: null,
    });
  } catch (error) {
    console.error("[API] Sync demo error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to sync demo status" },
      { status: 500 }
    );
  }
}
