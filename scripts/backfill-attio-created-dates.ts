import prisma from "../lib/prisma";

/**
 * Restores the original Attio creation date on records imported from Attio.
 *
 * The import stamped every row with the date it ran, which made a two-year-old
 * contact look like it was added yesterday. The real date was preserved in
 * customFields.attioCreatedAt, so no API access is needed to correct it.
 *
 * Two groups carry no Attio timestamp of their own and are dated from the
 * earliest evidence we hold instead:
 *   - contacts created retroactively for historical form submissions, which are
 *     dated from the submission that first brought the lead in
 *   - deals, which the import synthesised from each company's pipeline status,
 *     and so inherit the date of the company they belong to
 *
 * Only ever moves a date backwards, which keeps the run idempotent and protects
 * records that already existed here before the import with an earlier date.
 *
 * The comparison ignores gaps under a second because createdAt is a
 * timestamp(3) column: Attio's nanosecond values round on write, which would
 * otherwise leave a row looking permanently out of date by a fraction of a
 * millisecond.
 *
 * Usage:
 *   pnpm tsx --env-file=.env scripts/backfill-attio-created-dates.ts
 *   pnpm tsx --env-file=.env scripts/backfill-attio-created-dates.ts --apply
 */

const LOG = "[Created Dates]";

const TARGETS = [
  { label: "people", table: "Person", nameColumn: "email" },
  { label: "companies", table: "ClientCompany", nameColumn: "name" },
];

const SUBMISSION_TARGETS = [
  {
    label: "contacts",
    table: "Person",
    nameColumn: "email",
    foreignKey: "personId",
  },
  {
    label: "companies",
    table: "ClientCompany",
    nameColumn: "name",
    foreignKey: "companyId",
  },
];

const isApply = process.argv.includes("--apply");

interface PreviewRow {
  label: string;
  current: Date;
  original: Date;
}

async function previewTable(
  table: string,
  nameColumn: string
): Promise<{ count: number; samples: PreviewRow[] }> {
  const [{ count }] = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*) AS count FROM "${table}"
     WHERE "createdAt" - ("customFields"->>'attioCreatedAt')::timestamptz > interval '1 second'`
  );

  const samples = await prisma.$queryRawUnsafe<PreviewRow[]>(
    `SELECT "${nameColumn}" AS label,
            "createdAt" AS current,
            ("customFields"->>'attioCreatedAt')::timestamptz AS original
     FROM "${table}"
     WHERE "createdAt" - ("customFields"->>'attioCreatedAt')::timestamptz > interval '1 second'
     ORDER BY ("customFields"->>'attioCreatedAt')::timestamptz ASC
     LIMIT 5`
  );

  return { count: Number(count), samples };
}

/**
 * Records created after the form submission that produced them, which happens
 * when a contact or company was reconstructed for a historical submission. The
 * submission is when the lead actually arrived.
 */
async function previewSubmissionDates(
  table: string,
  nameColumn: string,
  foreignKey: string
): Promise<{ count: number; samples: PreviewRow[] }> {
  const predicate = `EXISTS (
    SELECT 1 FROM "EmbedFormSubmission" s
    WHERE s."${foreignKey}" = t."id"
      AND t."createdAt" - s."createdAt" > interval '1 day')`;

  const [{ count }] = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*) AS count FROM "${table}" t WHERE ${predicate}`
  );

  const samples = await prisma.$queryRawUnsafe<PreviewRow[]>(
    `SELECT t."${nameColumn}" AS label,
            t."createdAt" AS current,
            (SELECT min(s."createdAt") FROM "EmbedFormSubmission" s
             WHERE s."${foreignKey}" = t."id") AS original
     FROM "${table}" t
     WHERE ${predicate}
     ORDER BY 3 ASC
     LIMIT 5`
  );

  return { count: Number(count), samples };
}

async function applySubmissionDates(
  table: string,
  foreignKey: string
): Promise<number> {
  return prisma.$executeRawUnsafe(
    `UPDATE "${table}" t
     SET "createdAt" = earliest.first_submission
     FROM (
       SELECT s."${foreignKey}" AS record_id, min(s."createdAt") AS first_submission
       FROM "EmbedFormSubmission" s
       WHERE s."${foreignKey}" IS NOT NULL
       GROUP BY s."${foreignKey}"
     ) AS earliest
     WHERE earliest.record_id = t."id"
       AND t."createdAt" - earliest.first_submission > interval '1 day'`
  );
}

/** Deals inherit their company's date, since the import invented the deal. */
async function previewDeals(): Promise<{
  count: number;
  samples: PreviewRow[];
}> {
  const [{ count }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*) AS count
    FROM "Deal" d
    JOIN "ClientCompany" c ON c."id" = d."companyId"
    WHERE d."createdAt" - c."createdAt" > interval '1 second'`;

  const samples = await prisma.$queryRaw<PreviewRow[]>`
    SELECT d."name" AS label,
           d."createdAt" AS current,
           c."createdAt" AS original
    FROM "Deal" d
    JOIN "ClientCompany" c ON c."id" = d."companyId"
    WHERE d."createdAt" - c."createdAt" > interval '1 second'
    ORDER BY c."createdAt" ASC
    LIMIT 5`;

  return { count: Number(count), samples };
}

async function main() {
  console.log(
    `${LOG} ${isApply ? "applying" : "previewing"} original Attio creation dates...`
  );

  for (const { label, table, nameColumn } of TARGETS) {
    const { count, samples } = await previewTable(table, nameColumn);

    console.log(`\n${LOG} ${label}: ${count} record(s) to correct`);

    for (const sample of samples) {
      console.log(
        `  ${sample.label}: ${sample.current.toISOString().slice(0, 10)} -> ${sample.original
          .toISOString()
          .slice(0, 10)}`
      );
    }

    if (!isApply || count === 0) continue;

    // Raw SQL so updatedAt is left alone; Prisma would bump it on every write.
    const updated = await prisma.$executeRawUnsafe(
      `UPDATE "${table}"
       SET "createdAt" = ("customFields"->>'attioCreatedAt')::timestamptz
       WHERE "createdAt" - ("customFields"->>'attioCreatedAt')::timestamptz > interval '1 second'`
    );

    console.log(`${LOG} ${label}: updated ${updated} record(s)`);
  }

  for (const { label, table, nameColumn, foreignKey } of SUBMISSION_TARGETS) {
    const { count, samples } = await previewSubmissionDates(
      table,
      nameColumn,
      foreignKey
    );

    console.log(
      `\n${LOG} ${label} dated from their form submission: ${count} record(s) to correct`
    );

    for (const sample of samples) {
      console.log(
        `  ${sample.label}: ${sample.current.toISOString().slice(0, 10)} -> ${sample.original
          .toISOString()
          .slice(0, 10)}`
      );
    }

    if (!isApply || count === 0) continue;

    const updated = await applySubmissionDates(table, foreignKey);
    console.log(`${LOG} ${label}: updated ${updated} record(s)`);
  }

  // Runs last so deals follow any company date that just moved.
  const deals = await previewDeals();
  console.log(`\n${LOG} deals: ${deals.count} record(s) to correct`);

  for (const sample of deals.samples) {
    console.log(
      `  ${sample.label}: ${sample.current.toISOString().slice(0, 10)} -> ${sample.original
        .toISOString()
        .slice(0, 10)}`
    );
  }

  if (isApply && deals.count > 0) {
    const updated = await prisma.$executeRaw`
      UPDATE "Deal" d
      SET "createdAt" = c."createdAt"
      FROM "ClientCompany" c
      WHERE c."id" = d."companyId"
        AND d."createdAt" - c."createdAt" > interval '1 second'`;

    console.log(`${LOG} deals: updated ${updated} record(s)`);
  }

  if (!isApply) {
    console.log(`\n${LOG} preview only. Re-run with --apply to write.`);
    return;
  }

  console.log(`\n${LOG} verifying spread by year...`);

  for (const { label, table } of [...TARGETS, { label: "deals", table: "Deal" }]) {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ year: number; count: bigint }>
    >(
      `SELECT date_part('year', "createdAt")::int AS year, count(*) AS count
       FROM "${table}" GROUP BY 1 ORDER BY 1 ASC`
    );

    console.log(
      `  ${label}:`,
      rows.map((row) => `${row.year}: ${Number(row.count)}`).join(", ")
    );
  }
}

main()
  .catch((error) => {
    console.error(`${LOG} failed:`, error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
