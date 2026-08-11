import "server-only";

import prisma from "@/lib/prisma";

export async function getReportingOverview(clientId?: string) {
  try {
    console.log("[Reporting] loading reporting overview...");

    const [clients, metrics, reports, links] = await Promise.all([
      prisma.client.findMany({
        where: { status: { in: ["ACTIVE", "ONBOARDING"] } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, website: true, status: true },
      }),
      prisma.clientMetric.findMany({
        where: clientId ? { clientId } : undefined,
        orderBy: { periodStart: "desc" },
        take: 60,
        include: { client: { select: { id: true, name: true } } },
      }),
      prisma.report.findMany({
        where: clientId ? { clientId } : undefined,
        orderBy: { periodEnd: "desc" },
        include: { client: { select: { id: true, name: true } } },
      }),
      prisma.clientIntegrationLink.findMany({
        where: clientId ? { clientId } : undefined,
      }),
    ]);

    return { data: { clients, metrics, reports, links }, error: null };
  } catch (error) {
    console.error("[Reporting] failed to load overview", error);
    return { data: null, error: "Could not load reporting." };
  }
}
