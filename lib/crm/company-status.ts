import prisma from "@/lib/prisma";
import type { CompanyStatus } from "@prisma/client";

const LOG = "[Company Status]";

/**
 * The slice of a deal that determines what it contributes to its company's
 * status. Kept structural so callers can pass any shape that selects these.
 */
export interface DealStatusSnapshot {
  updatedAt: Date;
  stage: {
    order: number;
    isWon: boolean;
    isLost: boolean;
    companyStatus: CompanyStatus | null;
  };
}

const DEAL_SNAPSHOT_SELECT = {
  updatedAt: true,
  stage: {
    select: { order: true, isWon: true, isLost: true, companyStatus: true },
  },
} as const;

/** Won deals outrank open ones, which outrank lost ones. */
function outcomeRank(stage: DealStatusSnapshot["stage"]): number {
  if (stage.isWon) return 2;
  if (stage.isLost) return 0;
  return 1;
}

/**
 * Picks the status a company should show given all of its deals. An active
 * client who re-enters the pipeline stays PURCHASED rather than regressing to
 * whatever their newest open deal says, and a company whose only deals were
 * lost reads LOST rather than CHURNED.
 *
 * Returns null when no deal carries a mapped status, in which case the caller
 * should leave the existing value alone.
 */
export function deriveCompanyStatus(
  deals: DealStatusSnapshot[]
): CompanyStatus | null {
  const ranked = [...deals].sort((a, b) => {
    const byOutcome = outcomeRank(b.stage) - outcomeRank(a.stage);
    if (byOutcome !== 0) return byOutcome;

    const byStage = b.stage.order - a.stage.order;
    if (byStage !== 0) return byStage;

    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  // Custom stages may have no mapping, so fall through to the next best deal.
  for (const deal of ranked) {
    if (deal.stage.companyStatus) return deal.stage.companyStatus;
  }

  return null;
}

/**
 * Recomputes the Company.status mirror for the given companies from their
 * deals. This is the only place that writes Company.status.
 */
export async function syncCompanyStatuses(
  companyIds: (string | null | undefined)[]
): Promise<number> {
  const ids = [...new Set(companyIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return 0;

  const companies = await prisma.company.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      status: true,
      deals: { select: DEAL_SNAPSHOT_SELECT },
    },
  });

  let updated = 0;

  for (const company of companies) {
    const derived = deriveCompanyStatus(company.deals);
    if (!derived || derived === company.status) continue;

    console.log(
      `${LOG} "${company.name}" ${company.status} -> ${derived} (${company.deals.length} deals)`
    );

    await prisma.company.update({
      where: { id: company.id },
      data: { status: derived },
    });
    updated += 1;
  }

  return updated;
}

/** Recomputes the Company.status mirror for a single company. */
export async function syncCompanyStatus(
  companyId: string | null | undefined
): Promise<void> {
  await syncCompanyStatuses([companyId]);
}
