import { runUsaSpendingSync, getLastSuccessfulSync } from "@/lib/gov-sync";
import { createCronRoute } from "@/lib/cron/route-handler";

export const maxDuration = 300;

export const GET = createCronRoute("sync-usaspending", async () => {
  const lastSync = await getLastSuccessfulSync("USASPENDING");

  const isIncremental = !!lastSync;
  if (isIncremental) {
    console.log(
      `[Cron: sync-usaspending] last sync ${lastSync.toISOString()}, running incremental (current FY only)`
    );
  } else {
    console.log(
      "[Cron: sync-usaspending] no previous sync found, running full sync (all fiscal years)"
    );
  }

  const result = await runUsaSpendingSync({
    currentFiscalYearOnly: isIncremental,
  });

  if (!result.success) {
    return { data: null, error: result.error ?? "USASpending sync failed" };
  }

  return {
    data: { recordsProcessed: result.recordsProcessed },
    error: null,
  };
});
