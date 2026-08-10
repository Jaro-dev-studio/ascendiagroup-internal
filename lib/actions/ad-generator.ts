"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T> {
  data: T | null;
  error: string | null;
}

// ============================================================================
// Ad Targets
// ============================================================================

export async function createAdTarget(name: string): Promise<ActionResult<{ id: string }>> {
  try {
    const target = await prisma.adTarget.create({
      data: { name },
    });
    revalidatePath("/dashboard/ads/generator");
    return { data: { id: target.id }, error: null };
  } catch (error) {
    console.error("[createAdTarget] Error:", error);
    return { data: null, error: "Failed to create target" };
  }
}

export async function updateAdTarget(id: string, name: string): Promise<ActionResult<{ id: string }>> {
  try {
    const target = await prisma.adTarget.update({
      where: { id },
      data: { name },
    });
    revalidatePath("/dashboard/ads/generator");
    return { data: { id: target.id }, error: null };
  } catch (error) {
    console.error("[updateAdTarget] Error:", error);
    return { data: null, error: "Failed to update target" };
  }
}

export async function deleteAdTarget(id: string): Promise<ActionResult<boolean>> {
  try {
    await prisma.adTarget.delete({
      where: { id },
    });
    revalidatePath("/dashboard/ads/generator");
    return { data: true, error: null };
  } catch (error) {
    console.error("[deleteAdTarget] Error:", error);
    return { data: null, error: "Failed to delete target" };
  }
}

// ============================================================================
// Ad Solutions
// ============================================================================

export async function createAdSolution(text: string, targetIds?: string[]): Promise<ActionResult<{ id: string }>> {
  try {
    const solution = await prisma.adSolution.create({
      data: {
        text,
        ...(targetIds && targetIds.length > 0
          ? { targets: { connect: targetIds.map((id) => ({ id })) } }
          : {}),
      },
    });
    revalidatePath("/dashboard/ads/generator");
    return { data: { id: solution.id }, error: null };
  } catch (error) {
    console.error("[createAdSolution] Error:", error);
    return { data: null, error: "Failed to create solution" };
  }
}

export async function updateAdSolution(id: string, text: string, targetIds?: string[]): Promise<ActionResult<{ id: string }>> {
  try {
    const solution = await prisma.adSolution.update({
      where: { id },
      data: {
        text,
        ...(targetIds !== undefined
          ? { targets: { set: targetIds.map((tid) => ({ id: tid })) } }
          : {}),
      },
    });
    revalidatePath("/dashboard/ads/generator");
    return { data: { id: solution.id }, error: null };
  } catch (error) {
    console.error("[updateAdSolution] Error:", error);
    return { data: null, error: "Failed to update solution" };
  }
}

export async function updateSolutionTargets(solutionId: string, targetIds: string[]): Promise<ActionResult<{ id: string }>> {
  try {
    console.log(`[AdGenerator] Updating solution ${solutionId} target assignments to ${targetIds.length} targets...`);
    const solution = await prisma.adSolution.update({
      where: { id: solutionId },
      data: {
        targets: { set: targetIds.map((id) => ({ id })) },
      },
    });
    revalidatePath("/dashboard/ads/generator");
    return { data: { id: solution.id }, error: null };
  } catch (error) {
    console.error("[updateSolutionTargets] Error:", error);
    return { data: null, error: "Failed to update solution targets" };
  }
}

export async function updateSolutionDestinations(solutionId: string, destinationIds: string[]): Promise<ActionResult<{ id: string }>> {
  try {
    console.log(`[AdGenerator] Updating solution ${solutionId} destination assignments to ${destinationIds.length} destinations...`);
    const solution = await prisma.adSolution.update({
      where: { id: solutionId },
      data: {
        destinations: { set: destinationIds.map((id) => ({ id })) },
      },
    });
    revalidatePath("/dashboard/ads/generator");
    return { data: { id: solution.id }, error: null };
  } catch (error) {
    console.error("[updateSolutionDestinations] Error:", error);
    return { data: null, error: "Failed to update solution destinations" };
  }
}

export async function deleteAdSolution(id: string): Promise<ActionResult<boolean>> {
  try {
    await prisma.adSolution.delete({
      where: { id },
    });
    revalidatePath("/dashboard/ads/generator");
    return { data: true, error: null };
  } catch (error) {
    console.error("[deleteAdSolution] Error:", error);
    return { data: null, error: "Failed to delete solution" };
  }
}

// ============================================================================
// Ad Risk Reversals
// ============================================================================

export async function createAdRiskReversal(text: string): Promise<ActionResult<{ id: string }>> {
  try {
    const riskReversal = await prisma.adRiskReversal.create({
      data: { text },
    });
    revalidatePath("/dashboard/ads/generator");
    return { data: { id: riskReversal.id }, error: null };
  } catch (error) {
    console.error("[createAdRiskReversal] Error:", error);
    return { data: null, error: "Failed to create risk reversal" };
  }
}

export async function updateAdRiskReversal(id: string, text: string): Promise<ActionResult<{ id: string }>> {
  try {
    const riskReversal = await prisma.adRiskReversal.update({
      where: { id },
      data: { text },
    });
    revalidatePath("/dashboard/ads/generator");
    return { data: { id: riskReversal.id }, error: null };
  } catch (error) {
    console.error("[updateAdRiskReversal] Error:", error);
    return { data: null, error: "Failed to update risk reversal" };
  }
}

export async function deleteAdRiskReversal(id: string): Promise<ActionResult<boolean>> {
  try {
    await prisma.adRiskReversal.delete({
      where: { id },
    });
    revalidatePath("/dashboard/ads/generator");
    return { data: true, error: null };
  } catch (error) {
    console.error("[deleteAdRiskReversal] Error:", error);
    return { data: null, error: "Failed to delete risk reversal" };
  }
}

// ============================================================================
// Ad Destinations
// ============================================================================

export async function createAdDestination(label: string, url: string): Promise<ActionResult<{ id: string }>> {
  try {
    console.log(`[AdGenerator] Creating destination "${label}" -> ${url}`);
    const destination = await prisma.adDestination.create({
      data: { label, url },
    });
    revalidatePath("/dashboard/ads/generator");
    return { data: { id: destination.id }, error: null };
  } catch (error) {
    console.error("[createAdDestination] Error:", error);
    return { data: null, error: "Failed to create destination" };
  }
}

export async function updateAdDestination(id: string, label: string, url: string): Promise<ActionResult<{ id: string }>> {
  try {
    console.log(`[AdGenerator] Updating destination ${id} -> "${label}" ${url}`);
    const destination = await prisma.adDestination.update({
      where: { id },
      data: { label, url },
    });
    revalidatePath("/dashboard/ads/generator");
    return { data: { id: destination.id }, error: null };
  } catch (error) {
    console.error("[updateAdDestination] Error:", error);
    return { data: null, error: "Failed to update destination" };
  }
}

export async function deleteAdDestination(id: string): Promise<ActionResult<boolean>> {
  try {
    console.log(`[AdGenerator] Deleting destination ${id}`);
    await prisma.adDestination.delete({
      where: { id },
    });
    revalidatePath("/dashboard/ads/generator");
    return { data: true, error: null };
  } catch (error) {
    console.error("[deleteAdDestination] Error:", error);
    return { data: null, error: "Failed to delete destination" };
  }
}

// ============================================================================
// Ad Permutations
// ============================================================================

interface CreatePermutationData {
  targetId: string;
  solutionId: string;
  riskReversalId: string;
  destinationId?: string;
  metaCampaignId?: string;
  metaAdSetId?: string;
  adHeadline?: string;
  adPrimaryText?: string;
  adDescription?: string;
}

export async function createAdPermutation(data: CreatePermutationData): Promise<ActionResult<{ id: string }>> {
  try {
    const permutation = await prisma.adPermutation.create({
      data: {
        targetId: data.targetId,
        solutionId: data.solutionId,
        riskReversalId: data.riskReversalId,
        destinationId: data.destinationId,
        metaCampaignId: data.metaCampaignId,
        metaAdSetId: data.metaAdSetId,
        adHeadline: data.adHeadline,
        adPrimaryText: data.adPrimaryText,
        adDescription: data.adDescription,
      },
    });
    revalidatePath("/dashboard/ads/generator");
    return { data: { id: permutation.id }, error: null };
  } catch (error) {
    console.error("[createAdPermutation] Error:", error);
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { data: null, error: "This permutation already exists" };
    }
    return { data: null, error: "Failed to create permutation" };
  }
}

interface UpdatePermutationData {
  metaAdId?: string;
  metaAdUrl?: string;
  metaCampaignId?: string;
  metaAdSetId?: string;
  adHeadline?: string;
  adPrimaryText?: string;
  adDescription?: string;
}

export async function updateAdPermutation(id: string, data: UpdatePermutationData): Promise<ActionResult<{ id: string }>> {
  try {
    const permutation = await prisma.adPermutation.update({
      where: { id },
      data,
    });
    revalidatePath("/dashboard/ads/generator");
    return { data: { id: permutation.id }, error: null };
  } catch (error) {
    console.error("[updateAdPermutation] Error:", error);
    return { data: null, error: "Failed to update permutation" };
  }
}

export async function deleteAdPermutation(id: string): Promise<ActionResult<boolean>> {
  try {
    await prisma.adPermutation.delete({
      where: { id },
    });
    revalidatePath("/dashboard/ads/generator");
    return { data: true, error: null };
  } catch (error) {
    console.error("[deleteAdPermutation] Error:", error);
    return { data: null, error: "Failed to delete permutation" };
  }
}

export async function deleteUnlinkedPermutations(): Promise<ActionResult<{ deleted: number }>> {
  try {
    console.log("[AdGenerator] Deleting permutations without linked ads...");
    const result = await prisma.adPermutation.deleteMany({
      where: { metaAdId: null },
    });
    console.log(`[AdGenerator] Deleted ${result.count} unlinked permutations`);
    revalidatePath("/dashboard/ads/generator");
    return { data: { deleted: result.count }, error: null };
  } catch (error) {
    console.error("[deleteUnlinkedPermutations] Error:", error);
    return { data: null, error: "Failed to delete unlinked permutations" };
  }
}

// Bulk create permutations for valid combinations (incremental - skips existing).
// Only generates for solutions that have both assigned targets AND assigned destinations.
export async function generateAllPermutations(): Promise<ActionResult<{ created: number; skipped: number }>> {
  try {
    console.log("[AdGenerator] Fetching all components for permutation generation...");
    const [targets, solutions, riskReversals, destinations, existingPermutations] = await Promise.all([
      prisma.adTarget.findMany(),
      prisma.adSolution.findMany({
        include: {
          targets: { select: { id: true } },
          destinations: { select: { id: true } },
        },
      }),
      prisma.adRiskReversal.findMany(),
      prisma.adDestination.findMany(),
      prisma.adPermutation.findMany({
        select: { targetId: true, solutionId: true, riskReversalId: true, destinationId: true },
      }),
    ]);

    const existingKeys = new Set(
      existingPermutations.map(
        (p) => `${p.targetId}:${p.solutionId}:${p.riskReversalId}:${p.destinationId ?? "null"}`
      )
    );

    let created = 0;
    let skipped = 0;

    const newPermutations: { targetId: string; solutionId: string; riskReversalId: string; destinationId: string }[] = [];

    for (const solution of solutions) {
      const assignedTargetIds = solution.targets.map((t) => t.id);
      const assignedDestinationIds = solution.destinations.map((d) => d.id);

      if (assignedTargetIds.length === 0) {
        console.log(`[AdGenerator] Solution "${solution.text.substring(0, 40)}..." -> no targets assigned, skipping`);
        continue;
      }

      if (assignedDestinationIds.length === 0) {
        console.log(`[AdGenerator] Solution "${solution.text.substring(0, 40)}..." -> no destinations assigned, skipping`);
        continue;
      }

      const validTargets = targets.filter((t) => assignedTargetIds.includes(t.id));
      const validDestinations = destinations.filter((d) => assignedDestinationIds.includes(d.id));
      console.log(`[AdGenerator] Solution "${solution.text.substring(0, 40)}..." -> ${validTargets.length} targets, ${validDestinations.length} destinations`);

      for (const target of validTargets) {
        for (const riskReversal of riskReversals) {
          for (const destination of validDestinations) {
            const key = `${target.id}:${solution.id}:${riskReversal.id}:${destination.id}`;
            if (existingKeys.has(key)) {
              skipped++;
            } else {
              newPermutations.push({
                targetId: target.id,
                solutionId: solution.id,
                riskReversalId: riskReversal.id,
                destinationId: destination.id,
              });
            }
          }
        }
      }
    }

    if (newPermutations.length > 0) {
      await prisma.adPermutation.createMany({
        data: newPermutations,
        skipDuplicates: true,
      });
      created = newPermutations.length;
    }

    console.log(`[AdGenerator] Permutation generation complete: ${created} created, ${skipped} skipped`);
    revalidatePath("/dashboard/ads/generator");
    return { data: { created, skipped }, error: null };
  } catch (error) {
    console.error("[generateAllPermutations] Error:", error);
    return { data: null, error: "Failed to generate permutations" };
  }
}
