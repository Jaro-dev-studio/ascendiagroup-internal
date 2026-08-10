import prisma from "@/lib/prisma";
import { UNASSIGNED_OWNER } from "@/config/crm-filter-fields";
import type { CrmFilterDynamicOptions } from "@/lib/crm/filters/columns";

const LOG = "[CRM Filters]";

/**
 * Option lists the filter builder cannot hard-code: team members, the stages
 * of every pipeline, and the industries actually present in the CRM.
 */
export async function getCrmFilterOptions(): Promise<{
  data: CrmFilterDynamicOptions | null;
  error: string | null;
}> {
  try {
    const [users, stages, companies] = await Promise.all([
      prisma.user.findMany({
        where: { role: { in: ["ADMIN", "DEVELOPER"] } },
        orderBy: { email: "asc" },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      prisma.pipelineStage.findMany({
        orderBy: [{ pipeline: { order: "asc" } }, { order: "asc" }],
        select: { id: true, name: true, pipeline: { select: { name: true } } },
      }),
      prisma.company.findMany({
        where: { industry: { not: null } },
        distinct: ["industry"],
        orderBy: { industry: "asc" },
        select: { industry: true },
      }),
    ]);

    // More than one pipeline makes bare stage names ambiguous
    const pipelineNames = new Set(stages.map((stage) => stage.pipeline.name));

    return {
      data: {
        owners: [
          { value: UNASSIGNED_OWNER, label: "Unassigned" },
          ...users.map((user) => ({
            value: user.id,
            label:
              [user.firstName, user.lastName].filter(Boolean).join(" ") ||
              user.email ||
              "Unknown",
          })),
        ],
        pipelineStages: stages.map((stage) => ({
          value: stage.id,
          label:
            pipelineNames.size > 1
              ? `${stage.pipeline.name}: ${stage.name}`
              : stage.name,
        })),
        industries: companies
          .filter((company) => company.industry)
          .map((company) => ({
            value: company.industry as string,
            label: company.industry as string,
          })),
      },
      error: null,
    };
  } catch (error) {
    console.error(`${LOG} failed to load filter options:`, error);
    return { data: null, error: "Failed to load filter options" };
  }
}
