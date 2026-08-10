import { analyzeOpportunityBatch } from "@/lib/gov-analysis";
import { createCronRoute } from "@/lib/cron/route-handler";

export const maxDuration = 300;

export const GET = createCronRoute("analyze-opportunities", async (request) => {
  const { searchParams } = request.nextUrl;
  const batchSize = parseInt(searchParams.get("batchSize") || "20", 10);
  const concurrency = parseInt(searchParams.get("concurrency") || "5", 10);

  console.log(
    `[Cron: analyze-opportunities] batch: ${batchSize}, concurrency: ${concurrency}`
  );

  const result = await analyzeOpportunityBatch({
    batchSize,
    concurrency,
    staleAfterDays: 7,
    activeOnly: true,
  });

  return {
    data: { analyzed: result.analyzed, errors: result.errors },
    error: null,
    failures:
      result.errors > 0
        ? [`${result.errors} opportunity analysis call(s) failed`]
        : undefined,
  };
});
