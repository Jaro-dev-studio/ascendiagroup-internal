import "server-only";

import prisma from "@/lib/prisma";

export async function listMeetings(clientId?: string) {
  try {
    console.log("[Meetings] listing calls...");

    const meetings = await prisma.meeting.findMany({
      where: clientId ? { clientId } : undefined,
      orderBy: { occurredAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { actionItems: true } },
      },
    });

    return { data: meetings, error: null };
  } catch (error) {
    console.error("[Meetings] failed to list calls", error);
    return { data: null, error: "Could not load calls." };
  }
}

export async function getMeeting(id: string) {
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        createdBy: { select: { name: true, email: true } },
        actionItems: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!meeting) return { data: null, error: "Call not found." };
    return { data: meeting, error: null };
  } catch (error) {
    console.error("[Meetings] failed to load call", error);
    return { data: null, error: "Could not load this call." };
  }
}

export async function listWhatsAppMessages(clientId?: string) {
  try {
    console.log("[WhatsApp] listing captured messages...");

    const messages = await prisma.whatsAppMessage.findMany({
      where: clientId ? { clientId } : undefined,
      orderBy: { sentAt: "desc" },
      take: 200,
      include: { client: { select: { id: true, name: true } } },
    });

    return { data: messages, error: null };
  } catch (error) {
    console.error("[WhatsApp] failed to list messages", error);
    return { data: null, error: "Could not load WhatsApp messages." };
  }
}
