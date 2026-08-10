import prisma from "@/lib/prisma";
import { recomputeAllEngagement } from "@/lib/crm/engagement";
import { syncCompanyStatuses } from "@/lib/crm/company-status";
import { createCronRoute } from "@/lib/cron/route-handler";

export const maxDuration = 300;

/**
 * Rebuilds the denormalised engagement columns on every Person and Company.
 *
 * Meeting ingest and sequence reply sync already refresh the contacts they
 * touch, so this sweep exists to catch what those cannot see: newly synced
 * calendar events, an upcoming meeting becoming a past one, and connection
 * strength decaying as time passes with no interaction.
 */
export const GET = createCronRoute("recompute-engagement", async () => {
  const result = await recomputeAllEngagement();

  if (result.error) {
    return { data: null, error: result.error };
  }

  // Deal mutations already resync the companies they touch; this catches drift
  // from anything that edited a deal outside those paths.
  console.log("[Cron: recompute-engagement] resyncing company statuses...");

  const companies = await prisma.company.findMany({ select: { id: true } });
  const statusesUpdated = await syncCompanyStatuses(
    companies.map((company) => company.id)
  );

  return {
    data: { ...result.data, statusesUpdated },
    error: null,
  };
});
