import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { reportOpsFailure } from "@/lib/ops-alerts";
import { withWebhookAlerts } from "@/lib/webhooks/route-handler";

export const maxDuration = 30;

interface VercelDeploymentPayload {
  type: string;
  payload: {
    deployment: {
      id: string;
      url: string;
      name: string;
      meta?: Record<string, string>;
    };
    project: {
      id: string;
    };
    team?: {
      id: string | null;
    };
    user?: {
      id: string;
    };
    target?: string | null;
    links?: {
      deployment: string;
      project: string;
    };
  };
}

/**
 * Verify Vercel webhook signature
 */
function verifyVercelSignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  const hmac = crypto.createHmac("sha1", secret);
  const digest = hmac.update(body).digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

/**
 * Webhook endpoint for Vercel deployment notifications
 * Updates the Demo status and deploy URL when deployment completes
 */
export const POST = withWebhookAlerts("vercel", async (request) => {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-vercel-signature");
    const secret = process.env.VERCEL_WEBHOOK_SECRET;

    // Verify signature if secret is configured
    if (secret && !verifyVercelSignature(rawBody, signature, secret)) {
      await reportOpsFailure({
        source: "Webhook: vercel",
        severity: "WARNING",
        summary: "Rejected a Vercel webhook with an invalid signature",
        dedupeKey: "invalid signature",
      });
      return NextResponse.json(
        { data: null, error: "Invalid signature" },
        { status: 401 }
      );
    }

    const payload: VercelDeploymentPayload = JSON.parse(rawBody);

    console.log("[Vercel Webhook] Received:", payload.type);

    // We only care about successful production deployments
    if (payload.type !== "deployment.succeeded" && payload.type !== "deployment.ready") {
      // Handle deployment errors
      if (payload.type === "deployment.error" || payload.type === "deployment.failed") {
        const projectId = payload.payload?.project?.id;

        if (projectId) {
          const demo = await prisma.demo.findFirst({
            where: { vercelProjectId: projectId },
          });

          if (demo) {
            await prisma.demo.update({
              where: { id: demo.id },
              data: {
                status: "failed",
                errorMessage: "Vercel deployment failed",
              },
            });
            console.log("[Vercel Webhook] Demo marked as failed:", demo.id);

            await reportOpsFailure({
              source: "Webhook: vercel",
              summary: `Deployment failed for demo "${demo.name}"`,
              error: payload.type,
              context: { demoId: demo.id, projectId },
              dedupeKey: `deployment failed:${demo.id}`,
              url: "/dashboard/demos",
            });
          }
        }
      }

      return NextResponse.json({
        data: { received: true, processed: false },
        error: null,
      });
    }

    const { deployment, project } = payload.payload;
    const projectId = project.id;

    console.log("[Vercel Webhook] Project ID:", projectId);
    console.log("[Vercel Webhook] Deployment URL:", deployment.url);

    if (!projectId) {
      console.error("[Vercel Webhook] Missing project.id in payload");
      return NextResponse.json(
        { data: null, error: "Missing projectId" },
        { status: 400 }
      );
    }

    // Find the demo by vercelProjectId
    const demo = await prisma.demo.findFirst({
      where: { vercelProjectId: projectId },
    });

    if (!demo) {
      console.log("[Vercel Webhook] No demo found for projectId:", projectId);
      // This might be a deployment for a different project, not an error
      return NextResponse.json({
        data: { received: true, processed: false },
        error: null,
      });
    }

    console.log("[Vercel Webhook] Found demo:", demo.id, "Current status:", demo.status);

    // Use production alias URL (project-name.vercel.app) instead of deployment-specific URL
    // The deployment.url contains a hash that may cause redirect issues with iframe embedding
    const deployUrl = `https://${deployment.name}.vercel.app`;

    console.log("[Vercel Webhook] Deployment URL from webhook:", deployment.url);
    console.log("[Vercel Webhook] Using production alias:", deployUrl);

    // Update demo with deployment URL and ready status
    await prisma.demo.update({
      where: { id: demo.id },
      data: {
        status: "ready",
        vercelDeployUrl: deployUrl,
        errorMessage: null,
      },
    });

    console.log("[Vercel Webhook] Demo status updated to 'ready':", deployUrl);

    return NextResponse.json({
      data: { received: true, demoId: demo.id, deployUrl },
      error: null,
    });
  } catch (err) {
    await reportOpsFailure({
      source: "Webhook: vercel",
      summary: "Failed to process a Vercel deployment event",
      error: err,
      url: "/dashboard/demos",
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
