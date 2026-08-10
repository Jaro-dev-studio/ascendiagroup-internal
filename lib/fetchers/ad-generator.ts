import prisma from "@/lib/prisma";

// ============================================================================
// Types
// ============================================================================

interface FetchResult<T> {
  data: T | null;
  error: string | null;
}

export interface AdTarget {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdSolution {
  id: string;
  text: string;
  targetIds: string[];
  destinationIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AdRiskReversal {
  id: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdDestination {
  id: string;
  label: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdPermutation {
  id: string;
  targetId: string;
  solutionId: string;
  riskReversalId: string;
  destinationId: string | null;
  metaAdId: string | null;
  metaAdUrl: string | null;
  metaCampaignId: string | null;
  metaAdSetId: string | null;
  adHeadline: string | null;
  adPrimaryText: string | null;
  adDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  target: AdTarget;
  solution: AdSolution;
  riskReversal: AdRiskReversal;
  destination: AdDestination | null;
}

// ============================================================================
// Fetchers
// ============================================================================

export async function fetchAdTargets(): Promise<FetchResult<AdTarget[]>> {
  try {
    const targets = await prisma.adTarget.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { data: targets, error: null };
  } catch (error) {
    console.error("[fetchAdTargets] Error:", error);
    return { data: null, error: "Failed to fetch targets" };
  }
}

export async function fetchAdSolutions(): Promise<FetchResult<AdSolution[]>> {
  try {
    const solutions = await prisma.adSolution.findMany({
      include: {
        targets: { select: { id: true } },
        destinations: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return {
      data: solutions.map((s) => ({
        ...s,
        targetIds: s.targets.map((t) => t.id),
        destinationIds: s.destinations.map((d) => d.id),
      })),
      error: null,
    };
  } catch (error) {
    console.error("[fetchAdSolutions] Error:", error);
    return { data: null, error: "Failed to fetch solutions" };
  }
}

export async function fetchAdRiskReversals(): Promise<FetchResult<AdRiskReversal[]>> {
  try {
    const riskReversals = await prisma.adRiskReversal.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { data: riskReversals, error: null };
  } catch (error) {
    console.error("[fetchAdRiskReversals] Error:", error);
    return { data: null, error: "Failed to fetch risk reversals" };
  }
}

export async function fetchAdDestinations(): Promise<FetchResult<AdDestination[]>> {
  try {
    const destinations = await prisma.adDestination.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { data: destinations, error: null };
  } catch (error) {
    console.error("[fetchAdDestinations] Error:", error);
    return { data: null, error: "Failed to fetch destinations" };
  }
}

export async function fetchAdPermutations(): Promise<FetchResult<AdPermutation[]>> {
  try {
    const permutations = await prisma.adPermutation.findMany({
      include: {
        target: true,
        solution: {
          include: {
            targets: { select: { id: true } },
            destinations: { select: { id: true } },
          },
        },
        riskReversal: true,
        destination: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return {
      data: permutations.map((p) => ({
        ...p,
        solution: {
          ...p.solution,
          targetIds: p.solution.targets.map((t) => t.id),
          destinationIds: p.solution.destinations.map((d) => d.id),
        },
      })),
      error: null,
    };
  } catch (error) {
    console.error("[fetchAdPermutations] Error:", error);
    return { data: null, error: "Failed to fetch permutations" };
  }
}

export async function fetchAdGeneratorData(): Promise<FetchResult<{
  targets: AdTarget[];
  solutions: AdSolution[];
  riskReversals: AdRiskReversal[];
  destinations: AdDestination[];
  permutations: AdPermutation[];
}>> {
  try {
    const [targets, rawSolutions, riskReversals, destinations, permutations] = await Promise.all([
      prisma.adTarget.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.adSolution.findMany({
        include: {
          targets: { select: { id: true } },
          destinations: { select: { id: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.adRiskReversal.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.adDestination.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.adPermutation.findMany({
        include: {
          target: true,
          solution: {
            include: {
              targets: { select: { id: true } },
              destinations: { select: { id: true } },
            },
          },
          riskReversal: true,
          destination: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const solutions = rawSolutions.map((s) => ({
      ...s,
      targetIds: s.targets.map((t) => t.id),
      destinationIds: s.destinations.map((d) => d.id),
    }));

    const mappedPermutations = permutations.map((p) => ({
      ...p,
      solution: {
        ...p.solution,
        targetIds: p.solution.targets.map((t) => t.id),
        destinationIds: p.solution.destinations.map((d) => d.id),
      },
    }));

    return {
      data: {
        targets,
        solutions,
        riskReversals,
        destinations,
        permutations: mappedPermutations,
      },
      error: null,
    };
  } catch (error) {
    console.error("[fetchAdGeneratorData] Error:", error);
    return { data: null, error: "Failed to fetch ad generator data" };
  }
}
