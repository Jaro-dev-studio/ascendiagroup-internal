"use server";

import { revalidatePath } from "next/cache";
import type { MeetingType } from "@prisma/client";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-helpers";
import { summariseMeeting } from "@/lib/ai/meeting";

export async function saveMeeting(input: {
  id?: string;
  clientId: string;
  title: string;
  type: string;
  occurredAt: string;
  durationMinutes?: string;
  attendees?: string;
  recordingUrl?: string;
  transcript?: string;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const user = await requireStaff();
    console.log(`[Meetings] saving call "${input.title}"...`);

    if (!input.clientId) return { data: null, error: "Choose a client." };
    if (input.title.trim().length < 2) {
      return { data: null, error: "Give the call a title." };
    }

    const occurredAt = new Date(input.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      return { data: null, error: "Enter a valid call date." };
    }

    const data = {
      title: input.title.trim(),
      type: input.type as MeetingType,
      occurredAt,
      durationMinutes: input.durationMinutes
        ? Number(input.durationMinutes) || null
        : null,
      attendees: (input.attendees ?? "")
        .split(",")
        .map((attendee) => attendee.trim())
        .filter(Boolean),
      recordingUrl: input.recordingUrl || null,
      transcript: input.transcript || null,
    };

    let meetingId = input.id;

    if (meetingId) {
      await prisma.meeting.update({ where: { id: meetingId }, data });
    } else {
      const created = await prisma.meeting.create({
        data: {
          ...data,
          clientId: input.clientId,
          source: input.transcript ? "UPLOAD" : "MANUAL",
          createdById: user.id,
        },
      });
      meetingId = created.id;

      await prisma.activityLog.create({
        data: {
          clientId: input.clientId,
          actorId: user.id,
          type: "MEETING_LOGGED",
          title: `Call logged: ${data.title}`,
          link: `/dashboard/meetings/${created.id}`,
        },
      });
    }

    revalidatePath("/dashboard/meetings");
    revalidatePath(`/dashboard/meetings/${meetingId}`);
    revalidatePath(`/dashboard/clients/${input.clientId}`);
    return { data: { id: meetingId }, error: null };
  } catch (error) {
    console.error("[Meetings] failed to save call", error);
    return { data: null, error: "Could not save the call." };
  }
}

export async function deleteMeeting(
  id: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    await prisma.meeting.delete({ where: { id } });
    revalidatePath("/dashboard/meetings");
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Meetings] failed to delete call", error);
    return { data: null, error: "Could not delete the call." };
  }
}

export async function summariseMeetingAction(
  id: string
): Promise<{ data: { summary: string } | null; error: string | null }> {
  try {
    await requireStaff();
    const result = await summariseMeeting(id);

    revalidatePath(`/dashboard/meetings/${id}`);
    revalidatePath("/dashboard/knowledge-base");
    return { data: { summary: result.summary }, error: null };
  } catch (error) {
    console.error("[Meetings] summarisation failed", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Could not summarise this call.",
    };
  }
}

/** Turns the extracted action items into real tasks on the client board. */
export async function pushMeetingActionsToBoard(
  meetingId: string
): Promise<{ data: { created: number; projectId: string } | null; error: string | null }> {
  try {
    const user = await requireStaff();
    console.log(`[Meetings] pushing action items for ${meetingId} to the board...`);

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { client: true, actionItems: true },
    });

    if (!meeting) return { data: null, error: "Call not found." };

    const pending = meeting.actionItems.filter((item) => !item.taskId);
    if (pending.length === 0) {
      return { data: null, error: "Every action item is already on the board." };
    }

    let project = await prisma.project.findFirst({
      where: { clientId: meeting.clientId, status: { not: "COMPLETED" } },
      orderBy: { createdAt: "desc" },
    });

    if (!project) {
      project = await prisma.project.create({
        data: {
          clientId: meeting.clientId,
          name: `${meeting.client.name} — delivery`,
          status: "ACTIVE",
          startDate: new Date(),
          ownerId: user.id,
        },
      });
    }

    let created = 0;
    for (const item of pending) {
      const task = await prisma.task.create({
        data: {
          projectId: project.id,
          clientId: meeting.clientId,
          title: item.title,
          description: item.owner ? `Owner from the call: ${item.owner}` : null,
          dueDate: item.dueDate,
          source: "MEETING",
          sourceRef: meetingId,
          position: created,
        },
      });

      await prisma.meetingActionItem.update({
        where: { id: item.id },
        data: { taskId: task.id },
      });
      created += 1;
    }

    revalidatePath(`/dashboard/meetings/${meetingId}`);
    revalidatePath(`/dashboard/projects/${project.id}`);
    revalidatePath("/dashboard/tasks");

    return { data: { created, projectId: project.id }, error: null };
  } catch (error) {
    console.error("[Meetings] failed to push action items", error);
    return { data: null, error: "Could not push the action items." };
  }
}
