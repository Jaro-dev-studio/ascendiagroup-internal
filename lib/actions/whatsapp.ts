"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-helpers";
import { ingestWhatsAppMessage } from "@/lib/whatsapp-ingest";

export async function captureWhatsAppMessage(input: {
  clientId: string;
  senderName: string;
  fromNumber: string;
  body: string;
  sentAt: string;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    console.log("[WhatsApp] capturing a message pasted by the team...");

    if (!input.clientId) return { data: null, error: "Choose a client." };
    if (input.body.trim().length < 1) {
      return { data: null, error: "Add the message text." };
    }

    const sentAt = input.sentAt ? new Date(input.sentAt) : new Date();

    const message = await ingestWhatsAppMessage({
      clientId: input.clientId,
      fromNumber: input.fromNumber || "manual-entry",
      senderName: input.senderName || null,
      body: input.body,
      sentAt: Number.isNaN(sentAt.getTime()) ? new Date() : sentAt,
      direction: "INBOUND",
    });

    revalidatePath("/dashboard/whatsapp");
    revalidatePath(`/dashboard/clients/${input.clientId}`);
    return { data: { id: message.id }, error: null };
  } catch (error) {
    console.error("[WhatsApp] failed to capture message", error);
    return { data: null, error: "Could not capture the message." };
  }
}

export async function assignWhatsAppMessage(input: {
  messageId: string;
  clientId: string;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    console.log(
      `[WhatsApp] assigning message ${input.messageId} to client ${input.clientId}...`
    );

    const message = await prisma.whatsAppMessage.update({
      where: { id: input.messageId },
      data: { clientId: input.clientId },
    });

    if (message.body) {
      await ingestWhatsAppMessage({
        clientId: input.clientId,
        fromNumber: message.fromNumber,
        senderName: message.senderName,
        body: message.body,
        sentAt: message.sentAt,
        direction: message.direction,
        existingId: message.id,
      });
    }

    revalidatePath("/dashboard/whatsapp");
    revalidatePath(`/dashboard/clients/${input.clientId}`);
    return { data: { id: message.id }, error: null };
  } catch (error) {
    console.error("[WhatsApp] failed to assign message", error);
    return { data: null, error: "Could not assign the message." };
  }
}

export async function deleteWhatsAppMessage(
  id: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    await prisma.whatsAppMessage.delete({ where: { id } });
    revalidatePath("/dashboard/whatsapp");
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[WhatsApp] failed to delete message", error);
    return { data: null, error: "Could not delete the message." };
  }
}
