import prisma from "../lib/prisma";
import { recomputeAllEngagement } from "../lib/crm/engagement";

/**
 * Populates the engagement columns on every Person and Company for the first
 * time, and prints how the connection strength buckets came out so the
 * thresholds in lib/crm/engagement.ts can be judged against real data.
 *
 * Safe to re-run: the recompute is idempotent and only writes rows whose
 * values actually changed. The cron does the same sweep every two hours.
 *
 * Usage:
 *   pnpm crm:backfill-engagement
 */

const LOG = "[Backfill Engagement]";

async function reportDistribution(table: "Person" | "ClientCompany") {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ bucket: string | null; count: bigint }>
  >(
    `SELECT "connectionStrength"::text AS bucket, count(*) AS count
     FROM "${table}" GROUP BY 1 ORDER BY 2 DESC`
  );

  console.log(
    `  ${table}:`,
    rows
      .map((row) => `${row.bucket ?? "no contact"}: ${Number(row.count)}`)
      .join(", ")
  );
}

async function main() {
  console.log(`${LOG} recomputing engagement for all people and companies...`);

  const result = await recomputeAllEngagement();

  if (result.error || !result.data) {
    throw new Error(result.error ?? "Recompute returned no summary");
  }

  const { peopleScanned, peopleUpdated, companiesScanned, companiesUpdated } =
    result.data;

  console.log(
    `${LOG} people: ${peopleUpdated}/${peopleScanned} updated, companies: ${companiesUpdated}/${companiesScanned} updated`
  );

  console.log(`\n${LOG} connection strength distribution:`);
  await reportDistribution("Person");
  await reportDistribution("ClientCompany");

  const withNextEvent = await prisma.person.count({
    where: { nextCalendarEventAt: { not: null } },
  });
  const withEmail = await prisma.person.count({
    where: { lastEmailInteractionAt: { not: null } },
  });
  const withMeeting = await prisma.person.count({
    where: { lastCalendarInteractionAt: { not: null } },
  });

  console.log(
    `\n${LOG} people with a next calendar event: ${withNextEvent}, last email: ${withEmail}, last meeting: ${withMeeting}`
  );
}

main()
  .catch((error) => {
    console.error(`${LOG} failed:`, error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
