import "server-only";

import prisma from "@/lib/prisma";

export interface DashboardOverview {
  counts: {
    activeClients: number;
    onboardingClients: number;
    openTasks: number;
    overdueTasks: number;
    pendingSubmissions: number;
    activeProjects: number;
  };
  onboarding: {
    id: string;
    name: string;
    status: string;
    accountManager: string | null;
    submittedAt: Date | null;
    projectCount: number;
    completedTasks: number;
    totalTasks: number;
  }[];
  myTasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: Date | null;
    clientName: string | null;
  }[];
  activity: {
    id: string;
    type: string;
    title: string;
    description: string | null;
    link: string | null;
    createdAt: Date;
    clientName: string | null;
    actorName: string | null;
  }[];
}

export async function getDashboardOverview(
  userId: string
): Promise<{ data: DashboardOverview | null; error: string | null }> {
  try {
    console.log("[Dashboard] loading delivery overview...");

    const [
      activeClients,
      onboardingClients,
      openTasks,
      overdueTasks,
      pendingSubmissions,
      activeProjects,
      onboardingRecords,
      myTasks,
      activity,
    ] = await Promise.all([
      prisma.client.count({ where: { status: "ACTIVE" } }),
      prisma.client.count({ where: { status: "ONBOARDING" } }),
      prisma.task.count({ where: { status: { not: "DONE" } } }),
      prisma.task.count({
        where: { status: { not: "DONE" }, dueDate: { lt: new Date() } },
      }),
      prisma.onboardingSubmission.count({ where: { status: "SUBMITTED" } }),
      prisma.project.count({ where: { status: "ACTIVE" } }),
      prisma.client.findMany({
        where: { status: "ONBOARDING" },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          accountManager: { select: { name: true, email: true } },
          submissions: {
            orderBy: { invitedAt: "desc" },
            take: 1,
            select: { submittedAt: true },
          },
          projects: { select: { id: true } },
          tasks: { select: { status: true } },
        },
      }),
      prisma.task.findMany({
        where: { assigneeId: userId, status: { not: "DONE" } },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 8,
        include: { client: { select: { name: true } } },
      }),
      prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          client: { select: { name: true } },
          actor: { select: { name: true, email: true } },
        },
      }),
    ]);

    return {
      data: {
        counts: {
          activeClients,
          onboardingClients,
          openTasks,
          overdueTasks,
          pendingSubmissions,
          activeProjects,
        },
        onboarding: onboardingRecords.map((client) => ({
          id: client.id,
          name: client.name,
          status: client.status,
          accountManager:
            client.accountManager?.name ?? client.accountManager?.email ?? null,
          submittedAt: client.submissions[0]?.submittedAt ?? null,
          projectCount: client.projects.length,
          completedTasks: client.tasks.filter((task) => task.status === "DONE")
            .length,
          totalTasks: client.tasks.length,
        })),
        myTasks: myTasks.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          clientName: task.client?.name ?? null,
        })),
        activity: activity.map((entry) => ({
          id: entry.id,
          type: entry.type,
          title: entry.title,
          description: entry.description,
          link: entry.link,
          createdAt: entry.createdAt,
          clientName: entry.client?.name ?? null,
          actorName: entry.actor?.name ?? entry.actor?.email ?? null,
        })),
      },
      error: null,
    };
  } catch (error) {
    console.error("[Dashboard] failed to load overview", error);
    return { data: null, error: "Could not load the dashboard overview." };
  }
}
