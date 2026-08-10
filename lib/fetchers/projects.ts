import "server-only";

import prisma from "@/lib/prisma";

export async function listProjects(clientId?: string) {
  try {
    console.log("[Projects] listing projects...");

    const projects = await prisma.project.findMany({
      where: clientId ? { clientId } : undefined,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        client: { select: { id: true, name: true } },
        owner: { select: { name: true, email: true } },
        tasks: { select: { status: true } },
      },
    });

    return { data: projects, error: null };
  } catch (error) {
    console.error("[Projects] failed to list projects", error);
    return { data: null, error: "Could not load projects." };
  }
}

export async function getProject(id: string) {
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, driveFolderUrl: true } },
        owner: { select: { id: true, name: true, email: true } },
        tasks: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          include: { assignee: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!project) return { data: null, error: "Project not found." };
    return { data: project, error: null };
  } catch (error) {
    console.error("[Projects] failed to load project", error);
    return { data: null, error: "Could not load this project." };
  }
}

export async function listTasks(filters?: {
  status?: string;
  assigneeId?: string;
  clientId?: string;
}) {
  try {
    console.log("[Tasks] listing tasks...");

    const tasks = await prisma.task.findMany({
      where: {
        status: filters?.status ? (filters.status as never) : undefined,
        assigneeId: filters?.assigneeId || undefined,
        clientId: filters?.clientId || undefined,
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    return { data: tasks, error: null };
  } catch (error) {
    console.error("[Tasks] failed to list tasks", error);
    return { data: null, error: "Could not load tasks." };
  }
}
