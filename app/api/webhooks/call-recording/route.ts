import { NextResponse } from "next/server";
import type { MeetingType } from "@prisma/client";

import prisma from "@/lib/prisma";
import { getIntegrationCredentials } from "@/lib/integrations/store";

export const dynamic = "force-dynamic";

interface RecordingWebhookBody {
  externalId?: string;
  clientId?: string;
  clientEmail?: string;
  title?: string;
  type?: string;
  occurredAt?: string;
  durationMinutes?: number;
  attendees?: string[];
  recordingUrl?: string;
  transcript?: string;
}

const VALID_TYPES: MeetingType[] = [
  "SALES_CALL",
  "ONBOARDING_CALL",
  "STRATEGY_CALL",
  "CHECK_IN",
  "OTHER",
];

/** Health check so the recorder can validate the endpoint before sending data. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const credentials = await getIntegrationCredentials("CALL_RECORDING");
  const expected = credentials?.webhookToken ?? process.env.WEBHOOK_TOKEN;

  if (!expected) {
    return NextResponse.json(
      { error: "Call recording integration is not configured" },
      { status: 503 }
    );
  }

  if (token !== expected) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  return NextResponse.json({ status: "ready" });
}

export async function POST(request: Request) {
  try {
    console.log("[Recorder] webhook payload received...");

    const token =
      new URL(request.url).searchParams.get("token") ??
      request.headers.get("x-webhook-token");

    const credentials = await getIntegrationCredentials("CALL_RECORDING");
    const expected = credentials?.webhookToken ?? process.env.WEBHOOK_TOKEN;

    if (!expected || token !== expected) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = (await request.json()) as RecordingWebhookBody;

    let clientId = body.clientId ?? null;
    if (!clientId && body.clientEmail) {
      const client = await prisma.client.findFirst({
        where: { contactEmail: body.clientEmail },
        select: { id: true },
      });
      clientId = client?.id ?? null;
    }

    if (!clientId) {
      console.warn("[Recorder] no matching client for the payload");
      return NextResponse.json(
        { error: "No matching client. Send clientId or a known clientEmail." },
        { status: 422 }
      );
    }

    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
    const type = VALID_TYPES.includes(body.type as MeetingType)
      ? (body.type as MeetingType)
      : "SALES_CALL";

    const meeting = await prisma.meeting.upsert({
      where: { externalId: body.externalId ?? `recording-${Date.now()}` },
      create: {
        clientId,
        externalId: body.externalId ?? `recording-${Date.now()}`,
        title: body.title ?? "Recorded call",
        type,
        occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
        durationMinutes: body.durationMinutes ?? null,
        attendees: body.attendees ?? [],
        recordingUrl: body.recordingUrl ?? null,
        transcript: body.transcript ?? null,
        source: "RECORDING_WEBHOOK",
      },
      update: {
        transcript: body.transcript ?? undefined,
        recordingUrl: body.recordingUrl ?? undefined,
        durationMinutes: body.durationMinutes ?? undefined,
      },
    });

    await prisma.activityLog.create({
      data: {
        clientId,
        type: "MEETING_LOGGED",
        title: `Call recorded: ${meeting.title}`,
        link: `/dashboard/meetings/${meeting.id}`,
      },
    });

    console.log(`[Recorder] stored call ${meeting.id}`);
    return NextResponse.json({ id: meeting.id });
  } catch (error) {
    console.error("[Recorder] webhook processing failed", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
