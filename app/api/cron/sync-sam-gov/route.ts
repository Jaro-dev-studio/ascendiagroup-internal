import { runSamGovSync, getLastSuccessfulSync } from "@/lib/gov-sync";
import { analyzeOpportunityBatch } from "@/lib/gov-analysis";
import { createCronRoute } from "@/lib/cron/route-handler";

export const maxDuration = 300;

export const GET = createCronRoute("sync-sam-gov", async () => {
  const lastSync = await getLastSuccessfulSync("SAM_GOV");

  let sinceDate: Date | undefined;
  if (lastSync) {
    sinceDate = new Date(lastSync);
    sinceDate.setDate(sinceDate.getDate() - 1);
    console.log(
      `[Cron: sync-sam-gov] incremental sync since ${sinceDate.toISOString()}`
    );
  } else {
    console.log("[Cron: sync-sam-gov] no previous sync found, running full sync");
  }

  const result = await runSamGovSync({ sinceDate });

  if (!result.success) {
    return { data: null, error: result.error ?? "SAM.gov sync failed" };
  }

  console.log(
    `[Cron: sync-sam-gov] processed ${result.recordsProcessed} records, triggering AI analysis...`
  );

  const analysis = await analyzeOpportunityBatch({
    batchSize: 10,
    staleAfterDays: 7,
    activeOnly: true,
  });

  return {
    data: {
      recordsProcessed: result.recordsProcessed,
      analyzed: analysis.analyzed,
      analysisErrors: analysis.errors,
    },
    error: null,
    failures:
      analysis.errors > 0
        ? [`${analysis.errors} opportunity analysis call(s) failed`]
        : undefined,
  };
});
