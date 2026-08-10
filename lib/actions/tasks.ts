"use server";

import { revalidatePath } from "next/cache";
import type { TaskPriority, TaskStatus } from "@prisma/client";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-helpers";

export interface TaskInput {
  title: string;
  description?: string;
  status: string;
  priority: string;
  projectId?: string;
  clientId?: string;
  assigneeId?: string;
  dueDate?: string;
}

export async function createTask(
  input: TaskInput
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const user = await requireStaff();
    console.log(`[Tasks] creating task "${input.title}"...`);

    if (input.title.trim().length < 2) {
      return { data: null, error: "Give the task a title." };
    }

    let clientId = input.clientId || null;
    if (!clientId && input.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId },
        select: { clientId: true },
      });
      clientId = project?.clientId ?? null;
    }

    const position = await prisma.task.count({
      where: { projectId: input.projectId || null, status: input.status as TaskStatus },
    });

    const task = await prisma.task.create({
      data: {
        title: input.title.trim(),
        description: input.description || null,
        status: input.status as TaskStatus,
        priority: input.priority as TaskPriority,
        projectId: input.projectId || null,
        clientId,
        assigneeId: input.assigneeId || null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        position,
      },
    });

    if (clientId) {
      await prisma.activityLog.create({
        data: {
          clientId,
          projectId: input.projectId || null,
          actorId: user.id,
          type: "TASK_CREATED",
          title: `Task added: ${task.title}`,
          link: input.projectId ? `/dashboard/projects/${input.projectId}` : null,
        },
      });
    }

    revalidatePath("/dashboard/tasks");
    if (input.projectId) revalidatePath(`/dashboard/projects/${input.projectId}`);
    return { data: { id: task.id }, error: null };
  } catch (error) {
    console.error("[Tasks] failed to create task", error);
    return { data: null, error: "Could not create the task." };
  }
}

export async function updateTask(
  id: string,
  input: TaskInput
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();

    const task = await prisma.task.update({
      where: { id },
      data: {
        title: input.title.trim(),
        description: input.description || null,
        status: input.status as TaskStatus,
        priority: input.priority as TaskPriority,
        assigneeId: input.assigneeId || null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        completedAt: input.status === "DONE" ? new Date() : null,
      },
    });

    revalidatePath("/dashboard/tasks");
    if (task.projectId) revalidatePath(`/dashboard/projects/${task.projectId}`);
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Tasks] failed to update task", error);
    return { data: null, error: "Could not update the task." };
  }
}

export async function setTaskStatus(
  id: string,
  status: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const user = await requireStaff();
    console.log(`[Tasks] moving task ${id} to ${status}...`);

    const task = await prisma.task.update({
      where: { id },
      data: {
        status: status as TaskStatus,
        completedAt: status === "DONE" ? new Date() : null,
      },
    });

    if (status === "DONE" && task.clientId) {
      await prisma.activityLog.create({
        data: {
          clientId: task.clientId,
          projectId: task.projectId,
          actorId: user.id,
          type: "TASK_COMPLETED",
          title: `Task completed: ${task.title}`,
        },
      });
    }

    revalidatePath("/dashboard/tasks");
    if (task.projectId) revalidatePath(`/dashboard/projects/${task.projectId}`);
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Tasks] failed to move task", error);
    return { data: null, error: "Could not move the task." };
  }
}

export async function deleteTask(
  id: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    const task = await prisma.task.delete({ where: { id } });

    revalidatePath("/dashboard/tasks");
    if (task.projectId) revalidatePath(`/dashboard/projects/${task.projectId}`);
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Tasks] failed to delete task", error);
    return { data: null, error: "Could not delete the task." };
  }
}
