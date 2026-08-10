import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { reportOpsFailure } from "@/lib/ops-alerts";
import { withWebhookAlerts } from "@/lib/webhooks/route-handler";

export const maxDuration = 30;

/**
 * Cursor webhook payload format (per docs)
 */
interface CursorWebhookPayload {
  event: "statusChange";
  timestamp: string;
  id: string; // Agent ID (e.g., bc_abc123)
  status: "CREATING" | "RUNNING" | "FINISHED" | "ERROR" | "STOPPED";
  source: {
    repository: string;
    ref: string;
  };
  target?: {
    url?: string;
    branchName?: string;
    prUrl?: string;
  };
  summary?: string;
}

/**
 * Verify Cursor webhook signature
 */
function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const expectedSignature =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  return signature === expectedSignature;
}

/**
 * Webhook endpoint for Cursor Cloud Agent status change notifications
 * Updates Demo or TaskAgentExecution status when an agent finishes or errors
 */
export const POST = withWebhookAlerts("cursor", async (request) => {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-webhook-signature");
    const webhookId = request.headers.get("x-webhook-id");
    const webhookEvent = request.headers.get("x-webhook-event");
    const secret = process.env.CURSOR_WEBHOOK_SECRET;

    console.log("[Cursor Webhook] Received webhook");
    console.log("[Cursor Webhook] Event:", webhookEvent);
    console.log("[Cursor Webhook] ID:", webhookId);

    // Verify signature if secret is configured
    if (secret && secret.length >= 32) {
      if (!verifyWebhookSignature(secret, rawBody, signature)) {
        await reportOpsFailure({
          source: "Webhook: cursor",
          severity: "WARNING",
          summary: "Rejected a Cursor webhook with an invalid signature",
          dedupeKey: "invalid signature",
        });
        return NextResponse.json(
          { data: null, error: "Invalid signature" },
          { status: 401 }
        );
      }
      console.log("[Cursor Webhook] Signature verified");
    }

    const payload: CursorWebhookPayload = JSON.parse(rawBody);

    console.log("[Cursor Webhook] Payload:", JSON.stringify(payload, null, 2));

    const { id: agentId, status, summary, target } = payload;

    if (!agentId) {
      console.error("[Cursor Webhook] Missing agent ID in payload");
      return NextResponse.json(
        { data: null, error: "Missing agent ID" },
        { status: 400 }
      );
    }

    // First, try to find a Demo by cursorAgentId
    const demo = await prisma.demo.findFirst({
      where: { cursorAgentId: agentId },
    });

    if (demo) {
      console.log("[Cursor Webhook] Found demo:", demo.id, "Current status:", demo.status);
      await handleDemoAgentUpdate(demo.id, status, summary);
      return NextResponse.json({
        data: { received: true, type: "demo", demoId: demo.id, agentStatus: status },
        error: null,
      });
    }

    // If no Demo found, try to find a TaskAgentExecution
    const taskExecution = await prisma.taskAgentExecution.findFirst({
      where: { cursorAgentId: agentId },
    });

    if (taskExecution) {
      console.log("[Cursor Webhook] Found task execution:", taskExecution.id, "Current status:", taskExecution.cursorAgentStatus);
      await handleTaskAgentExecutionUpdate(taskExecution.id, status, summary, target);
      return NextResponse.json({
        data: { received: true, type: "task", executionId: taskExecution.id, agentStatus: status },
        error: null,
      });
    }

    // Neither Demo nor TaskAgentExecution found
    console.log("[Cursor Webhook] No Demo or TaskAgentExecution found for agentId:", agentId);
    return NextResponse.json({
      data: { received: true, processed: false, reason: "No matching record found" },
      error: null,
    });
  } catch (err) {
    await reportOpsFailure({
      source: "Webhook: cursor",
      summary: "Failed to process a Cursor agent status change",
      error: err,
    });

    return NextResponse.json(
      {
        data: null,
        error: err instanceof Error ? err.message : "Webhook processing failed",
      },
      { status: 500 }
    );
  }
});

/**
 * Handle Demo agent status updates
 */
async function handleDemoAgentUpdate(
  demoId: string,
  status: string,
  summary?: string
): Promise<void> {
  if (status === "FINISHED") {
    // Agent completed successfully - code has been pushed to GitHub
    // Vercel will auto-deploy and send its own webhook when ready
    await prisma.demo.update({
      where: { id: demoId },
      data: {
        status: "deploying",
        cursorAgentStatus: status,
        errorMessage: null,
      },
    });
    console.log("[Cursor Webhook] Demo status updated to 'deploying'");
    console.log("[Cursor Webhook] Summary:", summary);
  } else if (status === "ERROR" || status === "STOPPED") {
    const errorMessage =
      status === "ERROR"
        ? summary || "Cursor agent encountered an error"
        : "Cursor agent was stopped";

    await prisma.demo.update({
      where: { id: demoId },
      data: {
        status: "failed",
        cursorAgentStatus: status,
        errorMessage,
      },
    });
    console.log(`[Cursor Webhook] Demo status updated to 'failed' (${status})`);

    await reportOpsFailure({
      source: "Cursor agent",
      summary: "A demo build did not complete",
      error: errorMessage,
      context: { demoId, agentStatus: status },
      dedupeKey: `demo build failed:${demoId}`,
      url: "/dashboard/demos",
    });
  } else if (status === "RUNNING" || status === "CREATING") {
    await prisma.demo.update({
      where: { id: demoId },
      data: {
        cursorAgentStatus: status,
      },
    });
    console.log("[Cursor Webhook] Demo agent status:", status);
  }
}

/**
 * Handle TaskAgentExecution status updates
 */
async function handleTaskAgentExecutionUpdate(
  executionId: string,
  status: string,
  summary?: string,
  target?: { url?: string; branchName?: string; prUrl?: string }
): Promise<void> {
  if (status === "FINISHED") {
    // Agent completed successfully - PR has been created
    await prisma.taskAgentExecution.update({
      where: { id: executionId },
      data: {
        cursorAgentStatus: status,
        prUrl: target?.prUrl || null,
        branchName: target?.branchName || null,
        summary: summary || null,
        errorMessage: null,
      },
    });
    console.log("[Cursor Webhook] TaskAgentExecution status updated to 'FINISHED'");
    console.log("[Cursor Webhook] PR URL:", target?.prUrl);
    console.log("[Cursor Webhook] Branch:", target?.branchName);
    console.log("[Cursor Webhook] Summary:", summary);
  } else if (status === "ERROR" || status === "STOPPED") {
    const errorMessage =
      status === "ERROR"
        ? summary || "Cursor agent encountered an error"
        : "Cursor agent was stopped";

    await prisma.taskAgentExecution.update({
      where: { id: executionId },
      data: {
        cursorAgentStatus: status,
        errorMessage,
      },
    });
    console.log(`[Cursor Webhook] TaskAgentExecution status updated to '${status}'`);

    await reportOpsFailure({
      source: "Cursor agent",
      summary: "A task agent run did not complete",
      error: errorMessage,
      context: { executionId, agentStatus: status },
      dedupeKey: `task agent failed:${executionId}`,
      url: "/dashboard/tasks",
    });
  } else if (status === "RUNNING" || status === "CREATING") {
    await prisma.taskAgentExecution.update({
      where: { id: executionId },
      data: {
        cursorAgentStatus: status,
      },
    });
    console.log("[Cursor Webhook] TaskAgentExecution agent status:", status);
  }
}
