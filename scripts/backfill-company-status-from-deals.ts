import prisma from "../lib/prisma";
import type { CompanyStatus } from "@prisma/client";
import {
  resolveStageByCompanyStatus,
  syncDefaultPipeline,
  type PipelineWithStages,
} from "../lib/crm/pipeline";
import { deriveCompanyStatus } from "../lib/crm/company-status";

/**
 * Makes deals the source of truth for company status.
 *
 * Companies predating the deal pipeline carry a status with no deal behind it,
 * so this synthesises one deal per company from its current status — the same
 * approach the original Attio import used — and then recomputes every
 * Company.status mirror from the resulting deals.
 *
 * Safe to re-run: companies that already have a deal are left alone and the
 * recompute only writes rows whose value actually changed.
 *
 * Usage:
 *   pnpm crm:backfill-company-status           (dry run)
 *   pnpm crm:backfill-company-status --apply
 */

const LOG = "[Backfill Company Status]";

const isApply = process.argv.includes("--apply");

async function synthesiseMissingDeals(
  pipeline: PipelineWithStages
): Promise<number> {
  const companies = await prisma.company.findMany({
    where: { deals: { none: {} } },
    select: { id: true, name: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`${LOG} ${companies.length} companies have no deal`);

  const byStatus = new Map<CompanyStatus, number>();
  let created = 0;

  for (const company of companies) {
    const stage = resolveStageByCompanyStatus(pipeline, company.status);

    if (!stage) {
      console.warn(
        `${LOG} no stage maps to ${company.status}, skipping "${company.name}"`
      );
      continue;
    }

    byStatus.set(company.status, (byStatus.get(company.status) ?? 0) + 1);

    if (!isApply) {
      created += 1;
      continue;
    }

    await prisma.deal.create({
      data: {
        name: company.name,
        pipelineId: pipeline.id,
        stageId: stage.id,
        companyId: company.id,
        // Keep the deal's history aligned with the company it was derived from.
        createdAt: company.createdAt,
        wonAt: stage.isWon ? company.createdAt : null,
        lostAt: stage.isLost ? company.createdAt : null,
      },
    });
    created += 1;
  }

  for (const [status, count] of byStatus) {
    console.log(`  ${status}: ${count} deals`);
  }

  return created;
}

async function recomputeMirrors(): Promise<number> {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      deals: {
        select: {
          updatedAt: true,
          stage: {
            select: {
              order: true,
              isWon: true,
              isLost: true,
              companyStatus: true,
            },
          },
        },
      },
    },
  });

  console.log(`${LOG} recomputing status for ${companies.length} companies...`);

  let changed = 0;

  for (const company of companies) {
    const derived = deriveCompanyStatus(company.deals);
    if (!derived || derived === company.status) continue;

    console.log(`  "${company.name}": ${company.status} -> ${derived}`);
    changed += 1;

    if (!isApply) continue;

    await prisma.company.update({
      where: { id: company.id },
      data: { status: derived },
    });
  }

  return changed;
}

async function main() {
  console.log(`${LOG} ${isApply ? "APPLY" : "DRY RUN"} mode`);

  console.log(`${LOG} re-seeding pipeline stages...`);
  const pipeline = await syncDefaultPipeline();

  const created = await synthesiseMissingDeals(pipeline);
  console.log(
    `${LOG} ${isApply ? "created" : "would create"} ${created} deals\n`
  );

  const changed = await recomputeMirrors();
  console.log(
    `${LOG} ${isApply ? "updated" : "would update"} ${changed} company statuses`
  );

  if (!isApply) {
    console.log(`\n${LOG} re-run with --apply to write these changes`);
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
