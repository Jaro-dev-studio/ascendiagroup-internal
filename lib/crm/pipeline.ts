import prisma from "@/lib/prisma";
import type { CompanyStatus, Pipeline, PipelineStage } from "@prisma/client";
import { logCrmActivity } from "./activity";
import { syncCompanyStatus } from "./company-status";

export const DEFAULT_PIPELINE_SLUG = "sales";

const LOG = "[CRM Pipeline]";

interface StageSeed {
  name: string;
  order: number;
  probability: number;
  isWon: boolean;
  isLost: boolean;
  // The company-level status a deal in this stage contributes to the derived
  // Company.status mirror. See lib/crm/company-status.ts.
  companyStatus: CompanyStatus | null;
}

// Deals are the source of truth for status. "Lost Deal" means the company never
// bought; "Churned" means they did and then left, so the two map to different
// company statuses rather than collapsing into CHURNED.
const DEFAULT_STAGES: StageSeed[] = [
  { name: "Lead", order: 0, probability: 5, isWon: false, isLost: false, companyStatus: "FORM_SUBMITTED" },
  { name: "Form Submitted", order: 1, probability: 10, isWon: false, isLost: false, companyStatus: "FORM_SUBMITTED" },
  { name: "Booked Call", order: 2, probability: 25, isWon: false, isLost: false, companyStatus: "CALL_BOOKED" },
  { name: "No Show to Call", order: 3, probability: 10, isWon: false, isLost: false, companyStatus: "NO_SHOW" },
  { name: "Attended Call", order: 4, probability: 45, isWon: false, isLost: false, companyStatus: "ATTENDED_SALES_CALL" },
  { name: "Proposal Sent", order: 5, probability: 65, isWon: false, isLost: false, companyStatus: "ATTENDED_SALES_CALL" },
  { name: "Signed Contract", order: 6, probability: 90, isWon: true, isLost: false, companyStatus: "PURCHASED" },
  { name: "Paid Deposit", order: 7, probability: 95, isWon: true, isLost: false, companyStatus: "PURCHASED" },
  { name: "Paid Full Contract Value", order: 8, probability: 100, isWon: true, isLost: false, companyStatus: "PURCHASED" },
  { name: "Signed Renewal Contract", order: 9, probability: 100, isWon: true, isLost: false, companyStatus: "PURCHASED" },
  { name: "Paid Renewal", order: 10, probability: 100, isWon: true, isLost: false, companyStatus: "PURCHASED" },
  { name: "Lost Deal", order: 11, probability: 0, isWon: false, isLost: true, companyStatus: "LOST" },
  { name: "Churned", order: 12, probability: 0, isWon: false, isLost: true, companyStatus: "CHURNED" },
];

export type PipelineWithStages = Pipeline & { stages: PipelineStage[] };

/**
 * Idempotently creates the default sales pipeline and its stages. Safe to call
 * from any request path that needs a pipeline to exist.
 */
export async function ensureDefaultPipeline(): Promise<PipelineWithStages> {
  const existing = await prisma.pipeline.findUnique({
    where: { slug: DEFAULT_PIPELINE_SLUG },
    include: { stages: { orderBy: { order: "asc" } } },
  });

  if (existing && existing.stages.length >= DEFAULT_STAGES.length) {
    return existing;
  }

  return syncDefaultPipeline();
}

/**
 * Writes every stage seed, unlike ensureDefaultPipeline which skips the work
 * once the stage count matches. Use this after changing DEFAULT_STAGES so an
 * already-seeded pipeline picks up the new values.
 */
export async function syncDefaultPipeline(): Promise<PipelineWithStages> {
  console.log(`${LOG} Seeding default sales pipeline...`);

  const pipeline =
    (await prisma.pipeline.findUnique({
      where: { slug: DEFAULT_PIPELINE_SLUG },
    })) ??
    (await prisma.pipeline.create({
      data: {
        name: "Sales",
        slug: DEFAULT_PIPELINE_SLUG,
        isDefault: true,
        order: 0,
      },
    }));

  for (const stage of DEFAULT_STAGES) {
    await prisma.pipelineStage.upsert({
      where: { pipelineId_name: { pipelineId: pipeline.id, name: stage.name } },
      update: {
        order: stage.order,
        probability: stage.probability,
        isWon: stage.isWon,
        isLost: stage.isLost,
        companyStatus: stage.companyStatus,
      },
      create: {
        pipelineId: pipeline.id,
        name: stage.name,
        order: stage.order,
        probability: stage.probability,
        isWon: stage.isWon,
        isLost: stage.isLost,
        companyStatus: stage.companyStatus,
      },
    });
  }

  console.log(`${LOG} Seeded ${DEFAULT_STAGES.length} stages`);

  return prisma.pipeline.findUniqueOrThrow({
    where: { id: pipeline.id },
    include: { stages: { orderBy: { order: "asc" } } },
  });
}

/** Resolves a stage title to a stage on the pipeline, or null if there is no match. */
export function resolveStageByName(
  pipeline: PipelineWithStages,
  stageName: string
): PipelineStage | null {
  return (
    pipeline.stages.find(
      (stage) => stage.name.toLowerCase() === stageName.toLowerCase()
    ) ?? null
  );
}

/**
 * Finds the earliest stage that produces the given company status. Used to
 * synthesise a deal for a company that predates the deal pipeline.
 */
export function resolveStageByCompanyStatus(
  pipeline: PipelineWithStages,
  status: CompanyStatus
): PipelineStage | null {
  return pipeline.stages.find((stage) => stage.companyStatus === status) ?? null;
}

/**
 * Moves a deal to a new stage, writing won/lost timestamps, logging the change
 * to the timeline, and recomputing the company's derived status.
 */
export async function moveDealToStage(
  dealId: string,
  stageId: string,
  actorUserId?: string | null
): Promise<void> {
  const [deal, stage] = await Promise.all([
    prisma.deal.findUnique({
      where: { id: dealId },
      include: { stage: { select: { name: true } } },
    }),
    prisma.pipelineStage.findUnique({ where: { id: stageId } }),
  ]);

  if (!deal || !stage) return;
  if (deal.stageId === stageId) return;

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      stageId,
      wonAt: stage.isWon ? (deal.wonAt ?? new Date()) : null,
      lostAt: stage.isLost ? (deal.lostAt ?? new Date()) : null,
    },
  });

  await logCrmActivity({
    type: "STAGE_CHANGE",
    title: `Stage changed to ${stage.name}`,
    dealId,
    companyId: deal.companyId,
    personId: deal.primaryPersonId,
    actorUserId: actorUserId ?? null,
    payload: { from: deal.stage.name, to: stage.name },
  });

  await syncCompanyStatus(deal.companyId);
}

interface AdvanceCompanyDealOptions {
  /** Name for the deal when one has to be created. */
  dealName?: string;
  primaryPersonId?: string | null;
}

/**
 * Moves a company's open deal to the named stage, creating a deal when the
 * company has none open. Won and lost deals are never reopened, so a repeat
 * sale to an existing client starts a fresh deal rather than rewriting history.
 * Never moves a deal backwards, so a client who books another call does not
 * regress out of a later stage.
 *
 * Returns the id of the deal that now represents the company, or null when the
 * stage or company could not be resolved.
 */
export async function advanceCompanyDeal(
  companyId: string,
  stageName: string,
  options: AdvanceCompanyDealOptions = {}
): Promise<string | null> {
  const pipeline = await ensureDefaultPipeline();
  const stage = resolveStageByName(pipeline, stageName);

  if (!stage) {
    console.error(`${LOG} No stage named "${stageName}" on the sales pipeline`);
    return null;
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });

  if (!company) {
    console.error(`${LOG} Company ${companyId} not found`);
    return null;
  }

  const openDeal = await prisma.deal.findFirst({
    where: { companyId, stage: { isWon: false, isLost: false } },
    orderBy: [{ stage: { order: "desc" } }, { updatedAt: "desc" }],
    include: { stage: { select: { name: true, order: true } } },
  });

  if (!openDeal) {
    console.log(
      `${LOG} Creating deal for "${company.name}" at stage "${stage.name}"...`
    );

    const deal = await prisma.deal.create({
      data: {
        name: options.dealName ?? company.name,
        pipelineId: pipeline.id,
        stageId: stage.id,
        companyId,
        primaryPersonId: options.primaryPersonId ?? null,
        wonAt: stage.isWon ? new Date() : null,
        lostAt: stage.isLost ? new Date() : null,
      },
      select: { id: true },
    });

    await syncCompanyStatus(companyId);
    return deal.id;
  }

  if (openDeal.stage.order >= stage.order) {
    console.log(
      `${LOG} "${company.name}" is already at "${openDeal.stage.name}", not moving back to "${stage.name}"`
    );
    return openDeal.id;
  }

  console.log(
    `${LOG} Advancing "${company.name}" from "${openDeal.stage.name}" to "${stage.name}"...`
  );

  await moveDealToStage(openDeal.id, stage.id);
  return openDeal.id;
}
