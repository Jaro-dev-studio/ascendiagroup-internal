import { NextResponse } from "next/server";
import { after } from "next/server";
import { Webhook } from "svix";
import prisma from "@/lib/prisma";
import {
  ingestRecallRecording,
  requestTranscriptForRecording,
} from "@/lib/meetings/recall-ingest";
import { applyBotStatus } from "@/lib/meetings/recall-status";
import { reportOpsFailure } from "@/lib/ops-alerts";
import { withWebhookAlerts } from "@/lib/webhooks/route-handler";

export const maxDuration = 300;

const LOG = "[Recall Webhook]";

/**
 * Recall delivers via Svix and retries for 24 hours unless it gets a 2xx within
 * 15 seconds. Transcription and AI analysis take far longer than that, so the
 * request is acknowledged immediately and the heavy work runs in `after`.
 */

interface RecallWebhookPayload {
  event: string;
  data: {
    data?: { code?: string; sub_code?: string | null; updated_at?: string };
    bot?: { id: string; metadata?: Record<string, string> };
    recording?: { id: string; metadata?: Record<string, string> };
    transcript?: { id: string; metadata?: Record<string, string> };
  };
}

function verifySignature(
  body: string,
  headers: Headers
): { payload: RecallWebhookPayload | null; error: string | null } {
  const secret = process.env.RECALL_WEBHOOK_SECRET;

  if (!secret) {
    // Without a secret we cannot prove the caller is Recall, so refuse rather
    // than trusting arbitrary input.
    return {
      payload: null,
      error: "RECALL_WEBHOOK_SECRET is not configured",
    };
  }

  // Workspaces on a workspace verification secret sign with webhook-* headers;
  // legacy per-endpoint Svix secrets use svix-*. The scheme is identical, so
  // accept either spelling and hand the Svix verifier the names it expects.
  const id = headers.get("webhook-id") ?? headers.get("svix-id");
  const timestamp =
    headers.get("webhook-timestamp") ?? headers.get("svix-timestamp");
  const signature =
    headers.get("webhook-signature") ?? headers.get("svix-signature");

  if (!id || !timestamp || !signature) {
    return { payload: null, error: "Missing webhook signature headers" };
  }

  try {
    const webhook = new Webhook(secret);
    const payload = webhook.verify(body, {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    }) as RecallWebhookPayload;

    return { payload, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { payload: null, error: `Signature verification failed: ${message}` };
  }
}

export const POST = withWebhookAlerts("recall", async (request) => {
  const body = await request.text();

  const { payload, error } = verifySignature(body, request.headers);

  if (!payload) {
    console.error(`${LOG} rejected request: ${error}`);

    // A missing secret is a deployment problem that silently drops every
    // recording, so it is worth waking someone for; a bad signature is usually
    // noise from an unknown caller.
    await reportOpsFailure({
      source: "Webhook: recall",
      severity: process.env.RECALL_WEBHOOK_SECRET ? "WARNING" : "CRITICAL",
      summary: "Rejected an incoming Recall webhook",
      error,
      dedupeKey: "signature rejected",
    });

    return NextResponse.json({ data: null, error }, { status: 401 });
  }

  const event = payload.event;
  const botId = payload.data.bot?.id ?? null;
  const recordingId = payload.data.recording?.id ?? null;
  const transcriptId = payload.data.transcript?.id ?? null;
  const subCode = payload.data.data?.sub_code ?? null;

  console.log(`${LOG} received ${event} (bot=${botId ?? "none"})`);

  if (!botId) {
    // Recording deletion events and workspace-level notices carry no bot
    return NextResponse.json({ data: { ignored: true }, error: null });
  }

  if (event.startsWith("bot.")) {
    await applyBotStatus(botId, event.replace("bot.", ""), subCode);
    return NextResponse.json({ data: { handled: event }, error: null });
  }

  if (event === "recording.done" && recordingId) {
    // Work inside `after` runs once the response is sent, so a failure here is
    // invisible to Recall and will never be retried.
    after(async () => {
      const result = await requestTranscriptForRecording(botId, recordingId);
      if (result.error) {
        await reportOpsFailure({
          source: "Webhook: recall",
          summary: "Transcript request failed; the call has no transcript",
          error: result.error,
          context: { botId, recordingId },
        });
      }
    });
    return NextResponse.json({ data: { handled: event }, error: null });
  }

  if (event === "transcript.done") {
    after(async () => {
      const result = await ingestRecallRecording({
        botId,
        recordingId,
        transcriptId,
      });
      if (result.error) {
        await reportOpsFailure({
          source: "Webhook: recall",
          summary: "Recording ingest failed; the meeting is missing from the CRM",
          error: result.error,
          context: { botId, recordingId, transcriptId },
          url: "/dashboard/calls",
        });
      }
    });
    return NextResponse.json({ data: { handled: event }, error: null });
  }

  if (event === "recording.failed" || event === "transcript.failed") {
    console.error(`${LOG} ${event} for bot ${botId}: ${subCode ?? "no sub code"}`);
    await prisma.calendarEvent.updateMany({
      where: { recallBotId: botId },
      data: {
        decision: "FAILED",
        decisionReason: `${event}: ${subCode ?? "unknown reason"}`,
        botStatus: "failed",
      },
    });

    await reportOpsFailure({
      source: "Webhook: recall",
      summary: `Recall reported ${event}; the call was not captured`,
      error: subCode ?? "No sub code provided",
      context: { botId, event },
      dedupeKey: `${event}:${subCode ?? "unknown"}`,
      url: "/dashboard/upcoming-calls",
    });

    return NextResponse.json({ data: { handled: event }, error: null });
  }

  console.log(`${LOG} ignoring ${event}`);
  return NextResponse.json({ data: { ignored: true }, error: null });
});
