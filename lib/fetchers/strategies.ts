import "server-only";

import prisma from "@/lib/prisma";

export async function listStrategies(clientId?: string) {
  try {
    console.log("[Strategy] listing strategies...");

    const strategies = await prisma.strategy.findMany({
      where: clientId ? { clientId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        createdBy: { select: { name: true, email: true } },
        phases: { include: { _count: { select: { items: true } } } },
      },
    });

    return { data: strategies, error: null };
  } catch (error) {
    console.error("[Strategy] failed to list strategies", error);
    return { data: null, error: "Could not load strategies." };
  }
}

export async function getStrategy(id: string) {
  try {
    const strategy = await prisma.strategy.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        createdBy: { select: { name: true, email: true } },
        phases: {
          orderBy: { order: "asc" },
          include: { items: { orderBy: { order: "asc" } } },
        },
      },
    });

    if (!strategy) return { data: null, error: "Strategy not found." };
    return { data: strategy, error: null };
  } catch (error) {
    console.error("[Strategy] failed to load strategy", error);
    return { data: null, error: "Could not load this strategy." };
  }
}

export async function getStrategySources(clientId: string) {
  try {
    const [submissions, meetings] = await Promise.all([
      prisma.onboardingSubmission.findMany({
        where: { clientId, status: { not: "INVITED" } },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          submittedAt: true,
          form: { select: { name: true } },
          _count: { select: { answers: true } },
        },
      }),
      prisma.meeting.findMany({
        where: { clientId, transcript: { not: null } },
        orderBy: { occurredAt: "desc" },
        select: { id: true, title: true, type: true, occurredAt: true },
      }),
    ]);

    return { data: { submissions, meetings }, error: null };
  } catch (error) {
    console.error("[Strategy] failed to load sources", error);
    return { data: null, error: "Could not load strategy sources." };
  }
}
