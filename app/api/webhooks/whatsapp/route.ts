import { NextResponse } from "next/server";

import { getIntegrationCredentials } from "@/lib/integrations/store";
import { ingestWhatsAppMessage, matchClientByNumber } from "@/lib/whatsapp-ingest";

export const dynamic = "force-dynamic";

interface WhatsAppWebhookBody {
  entry?: {
    changes?: {
      value?: {
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        metadata?: { display_phone_number?: string };
        messages?: {
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          image?: { id?: string; mime_type?: string; caption?: string };
          document?: { id?: string; mime_type?: string; filename?: string };
          audio?: { id?: string; mime_type?: string };
        }[];
      };
    }[];
  }[];
}

/** Meta calls this once with a challenge to confirm ownership of the endpoint. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  console.log("[WhatsApp] webhook verification requested...");

  const credentials = await getIntegrationCredentials("WHATSAPP");
  if (!credentials?.verifyToken) {
    return NextResponse.json(
      { error: "WhatsApp integration is not configured" },
      { status: 503 }
    );
  }

  if (mode === "subscribe" && token === credentials.verifyToken) {
    console.log("[WhatsApp] webhook verified");
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(request: Request) {
  try {
    console.log("[WhatsApp] webhook payload received...");
    const body = (await request.json()) as WhatsAppWebhookBody;

    let stored = 0;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages?.length) continue;

        const contactName = value.contacts?.[0]?.profile?.name ?? null;
        const toNumber = value.metadata?.display_phone_number ?? null;

        for (const message of value.messages) {
          const fromNumber = message.from ?? "unknown";
          const clientId = await matchClientByNumber(fromNumber);
          const sentAt = message.timestamp
            ? new Date(Number(message.timestamp) * 1000)
            : new Date();

          const media = message.image ?? message.document ?? message.audio;

          await ingestWhatsAppMessage({
            clientId,
            externalId: message.id ?? null,
            fromNumber,
            toNumber,
            senderName: contactName,
            body:
              message.text?.body ??
              message.image?.caption ??
              message.document?.filename ??
              null,
            mediaUrl: null,
            mediaType: media ? (message.type ?? null) : null,
            sentAt,
            direction: "INBOUND",
          });

          stored += 1;
        }
      }
    }

    console.log(`[WhatsApp] stored ${stored} inbound message(s)`);
    return NextResponse.json({ received: stored });
  } catch (error) {
    console.error("[WhatsApp] webhook processing failed", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
