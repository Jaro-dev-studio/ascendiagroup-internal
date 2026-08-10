import "server-only";

import type { MessageDirection } from "@prisma/client";

import prisma from "@/lib/prisma";

const DOCUMENT_PREFIX = "whatsapp-thread-";

function normaliseNumber(value: string) {
  return value.replace(/[^\d]/g, "");
}

/** Finds the client whose stored WhatsApp number matches the sender. */
export async function matchClientByNumber(fromNumber: string) {
  const digits = normaliseNumber(fromNumber);
  if (!digits) return null;

  const candidates = await prisma.client.findMany({
    where: { whatsappNumber: { not: null } },
    select: { id: true, whatsappNumber: true },
  });

  return (
    candidates.find((client) => {
      const stored = normaliseNumber(client.whatsappNumber ?? "");
      if (!stored) return false;
      return stored.endsWith(digits) || digits.endsWith(stored);
    })?.id ?? null
  );
}

/**
 * Stores the message and keeps a single rolling knowledge base document per
 * client so Claude can search the conversation alongside forms and calls.
 */
export async function ingestWhatsAppMessage(input: {
  clientId: string | null;
  externalId?: string | null;
  fromNumber: string;
  toNumber?: string | null;
  senderName?: string | null;
  body: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  sentAt: Date;
  direction: MessageDirection;
  existingId?: string;
}) {
  console.log("[WhatsApp] ingesting message into the timeline...");

  const message = input.existingId
    ? await prisma.whatsAppMessage.update({
      where: { id: input.existingId },
      data: { clientId: input.clientId },
    })
    : await prisma.whatsAppMessage.create({
      data: {
        clientId: input.clientId,
        externalId: input.externalId ?? null,
        fromNumber: input.fromNumber,
        toNumber: input.toNumber ?? null,
        senderName: input.senderName ?? null,
        body: input.body,
        mediaUrl: input.mediaUrl ?? null,
        mediaType: input.mediaType ?? null,
        sentAt: input.sentAt,
        direction: input.direction,
      },
    });

  if (!input.clientId) {
    console.log("[WhatsApp] no matching client, message left unassigned");
    return message;
  }

  const documentId = `${DOCUMENT_PREFIX}${input.clientId}`;
  const line = `[${input.sentAt.toISOString()}] ${
    input.senderName ?? input.fromNumber
  }: ${input.body ?? `(${input.mediaType ?? "media"} attachment)`}${
    input.mediaUrl ? ` ${input.mediaUrl}` : ""
  }`;

  const existing = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
  });

  if (existing) {
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { content: `${existing.content}\n${line}` },
    });
  } else {
    await prisma.knowledgeDocument.create({
      data: {
        id: documentId,
        clientId: input.clientId,
        title: "WhatsApp conversation",
        source: "WHATSAPP",
        content: line,
        summary: "Rolling transcript of the client WhatsApp thread.",
      },
    });
  }

  await prisma.whatsAppMessage.update({
    where: { id: message.id },
    data: { documentId },
  });

  await prisma.activityLog.create({
    data: {
      clientId: input.clientId,
      type: "WHATSAPP_RECEIVED",
      title: "WhatsApp message captured",
      description: (input.body ?? "Media attachment").slice(0, 140),
      link: `/dashboard/whatsapp?clientId=${input.clientId}`,
    },
  });

  return message;
}
