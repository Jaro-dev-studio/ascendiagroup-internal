"use server";

import { revalidatePath } from "next/cache";
import type { ProjectStatus } from "@prisma/client";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-helpers";
import { createTrelloBoard, createTrelloCard, getFirstListId } from "@/lib/integrations/trello";

export async function createProject(input: {
  clientId: string;
  name: string;
  description?: string;
  status: string;
  dueDate?: string;
  ownerId?: string;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const user = await requireStaff();
    console.log(`[Projects] creating project "${input.name}"...`);

    if (!input.clientId) return { data: null, error: "Choose a client." };
    if (input.name.trim().length < 2) {
      return { data: null, error: "Give the project a name." };
    }

    const project = await prisma.project.create({
      data: {
        clientId: input.clientId,
        name: input.name.trim(),
        description: input.description || null,
        status: input.status as ProjectStatus,
        startDate: new Date(),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        ownerId: input.ownerId || user.id,
      },
    });

    await prisma.activityLog.create({
      data: {
        clientId: input.clientId,
        projectId: project.id,
        actorId: user.id,
        type: "PROJECT_CREATED",
        title: `Project created: ${project.name}`,
        link: `/dashboard/projects/${project.id}`,
      },
    });

    revalidatePath("/dashboard/projects");
    revalidatePath(`/dashboard/clients/${input.clientId}`);
    return { data: { id: project.id }, error: null };
  } catch (error) {
    console.error("[Projects] failed to create project", error);
    return { data: null, error: "Could not create the project." };
  }
}

export async function updateProject(
  id: string,
  input: {
    name: string;
    description?: string;
    status: string;
    dueDate?: string;
    ownerId?: string;
  }
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();

    await prisma.project.update({
      where: { id },
      data: {
        name: input.name.trim(),
        description: input.description || null,
        status: input.status as ProjectStatus,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        ownerId: input.ownerId || null,
      },
    });

    revalidatePath(`/dashboard/projects/${id}`);
    revalidatePath("/dashboard/projects");
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Projects] failed to update project", error);
    return { data: null, error: "Could not update the project." };
  }
}

export async function deleteProject(
  id: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    await prisma.project.delete({ where: { id } });
    revalidatePath("/dashboard/projects");
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Projects] failed to delete project", error);
    return { data: null, error: "Could not delete the project." };
  }
}

/** Mirrors the project board and its open tasks into Trello. */
export async function syncProjectToTrello(
  projectId: string
): Promise<{ data: { url: string; cards: number } | null; error: string | null }> {
  try {
    await requireStaff();
    console.log(`[Trello] syncing project ${projectId}...`);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { client: true, tasks: { where: { trelloCardId: null } } },
    });

    if (!project) return { data: null, error: "Project not found." };

    let boardId = project.trelloBoardId;
    let boardUrl = project.trelloBoardUrl;

    if (!boardId) {
      const board = await createTrelloBoard(
        `${project.client.name} — ${project.name}`
      );
      boardId = board.id;
      boardUrl = board.url;

      await prisma.project.update({
        where: { id: projectId },
        data: { trelloBoardId: board.id, trelloBoardUrl: board.url },
      });
    }

    const listId = await getFirstListId(boardId);
    if (!listId) return { data: null, error: "The Trello board has no lists." };

    let cards = 0;
    for (const task of project.tasks) {
      const card = await createTrelloCard({
        listId,
        name: task.title,
        description: task.description ?? undefined,
        dueDate: task.dueDate,
      });

      await prisma.task.update({
        where: { id: task.id },
        data: { trelloCardId: card.id },
      });
      cards += 1;
    }

    console.log(`[Trello] pushed ${cards} cards for project ${projectId}`);
    revalidatePath(`/dashboard/projects/${projectId}`);

    return { data: { url: boardUrl ?? "", cards }, error: null };
  } catch (error) {
    console.error("[Trello] project sync failed", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Could not sync to Trello.",
    };
  }
}
