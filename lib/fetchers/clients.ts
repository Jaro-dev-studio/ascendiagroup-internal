import "server-only";

import prisma from "@/lib/prisma";

export async function listClients(search?: string) {
  try {
    console.log("[Clients] listing clients...");

    const clients = await prisma.client.findMany({
      where: search
        ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { contactName: { contains: search, mode: "insensitive" } },
            { contactEmail: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
          ],
        }
        : undefined,
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        accountManager: { select: { name: true, email: true } },
        services: { select: { service: true } },
        _count: { select: { projects: true, tasks: true, documents: true } },
      },
    });

    return { data: clients, error: null };
  } catch (error) {
    console.error("[Clients] failed to list clients", error);
    return { data: null, error: "Could not load clients." };
  }
}

export async function getClientDetail(id: string) {
  try {
    console.log(`[Clients] loading client detail ${id}...`);

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        accountManager: { select: { id: true, name: true, email: true } },
        services: true,
        integrationLinks: true,
        projects: {
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { tasks: true } } },
        },
        submissions: {
          orderBy: { invitedAt: "desc" },
          include: { form: { select: { name: true } } },
        },
        strategies: {
          orderBy: { createdAt: "desc" },
          include: { phases: { include: { _count: { select: { items: true } } } } },
        },
        meetings: { orderBy: { occurredAt: "desc" }, take: 10 },
        documents: { orderBy: { updatedAt: "desc" }, take: 10 },
        whatsapp: { orderBy: { sentAt: "desc" }, take: 10 },
        metrics: { orderBy: { periodStart: "desc" }, take: 12 },
        reports: { orderBy: { periodEnd: "desc" }, take: 6 },
        activities: { orderBy: { createdAt: "desc" }, take: 20 },
        tasks: {
          orderBy: [{ status: "asc" }, { dueDate: "asc" }],
          include: { assignee: { select: { name: true, email: true } } },
        },
      },
    });

    if (!client) return { data: null, error: "Client not found." };
    return { data: client, error: null };
  } catch (error) {
    console.error("[Clients] failed to load client detail", error);
    return { data: null, error: "Could not load this client." };
  }
}

export async function listStaffUsers() {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true, role: { not: "CLIENT" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    });

    return { data: users, error: null };
  } catch (error) {
    console.error("[Team] failed to list staff users", error);
    return { data: null, error: "Could not load team members." };
  }
}

export async function listClientOptions() {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    });

    return { data: clients, error: null };
  } catch (error) {
    console.error("[Clients] failed to list client options", error);
    return { data: null, error: "Could not load clients." };
  }
}
