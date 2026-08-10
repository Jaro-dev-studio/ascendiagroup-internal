import {
  createAdTarget,
  updateAdTarget,
  deleteAdTarget,
  createAdSolution,
  updateAdSolution,
  deleteAdSolution,
  updateSolutionTargets,
  updateSolutionDestinations,
  createAdRiskReversal,
  updateAdRiskReversal,
  deleteAdRiskReversal,
  createAdDestination,
  updateAdDestination,
  deleteAdDestination,
  createAdPermutation,
  updateAdPermutation,
  deleteAdPermutation,
  deleteUnlinkedPermutations,
  generateAllPermutations,
} from "@/lib/actions/ad-generator";
import { defineTool, type AITool, type ToolArgs } from "../types";
import { changeSummary, unwrapAction } from "./helpers";

const AD_ENTITIES = ["target", "solution", "riskReversal", "destination"] as const;
type AdEntity = (typeof AD_ENTITIES)[number];

const ENTITY_NOUNS: Record<AdEntity, string> = {
  target: "ad target",
  solution: "ad solution",
  riskReversal: "risk reversal",
  destination: "ad destination",
};

/** The four ad building blocks share one CRUD shape, so they share three tools. */
const ENTITY_PROPERTIES = {
  entity: {
    type: "string",
    enum: [...AD_ENTITIES],
    description: "Which ad building block to act on",
  },
  name: { type: "string", description: "Target name (targets only)" },
  text: { type: "string", description: "Solution or risk reversal text" },
  label: { type: "string", description: "Destination label (destinations only)" },
  url: { type: "string", description: "Destination URL (destinations only)" },
  targetIds: {
    type: "array",
    items: { type: "string" },
    description: "Target IDs to link (solutions only)",
  },
  destinationIds: {
    type: "array",
    items: { type: "string" },
    description: "Destination IDs to link (solutions only)",
  },
};

function entityLabel(args: ToolArgs): string {
  const entity = args.entity as AdEntity;
  return ENTITY_NOUNS[entity] ?? "ad entity";
}

export const adWriteTools: AITool[] = [
  defineTool({
    name: "createAdEntity",
    label: "Create Ad Building Block",
    risk: "additive",
    description:
      "Create an ad generator building block: a target, solution, risk reversal or destination. Solution and risk reversal text uses curly braces for highlights, e.g. Save {$200K}.",
    parameters: {
      properties: ENTITY_PROPERTIES,
      required: ["entity"],
    },
    preview: async (args) => ({
      title: `Create ${entityLabel(args)}`,
      summary: changeSummary(args, ["entity"]),
    }),
    execute: async (args) => {
      const entity = args.entity as AdEntity;

      switch (entity) {
        case "target":
          return unwrapAction(createAdTarget(args.name as string));
        case "solution":
          return unwrapAction(
            createAdSolution(args.text as string, args.targetIds as string[] | undefined)
          );
        case "riskReversal":
          return unwrapAction(createAdRiskReversal(args.text as string));
        case "destination":
          return unwrapAction(createAdDestination(args.label as string, args.url as string));
        default:
          throw new Error(`Unknown ad entity: ${String(entity)}`);
      }
    },
  }),

  defineTool({
    name: "updateAdEntity",
    label: "Update Ad Building Block",
    risk: "additive",
    description:
      "Update an ad generator building block. For solutions you can also replace the linked targets or destinations.",
    parameters: {
      properties: { ...ENTITY_PROPERTIES, id: { type: "string", description: "The entity ID" } },
      required: ["entity", "id"],
    },
    preview: async (args) => ({
      title: `Update ${entityLabel(args)}`,
      summary: `${args.id} — ${changeSummary(args, ["entity", "id"])}`,
    }),
    execute: async (args) => {
      const entity = args.entity as AdEntity;
      const id = args.id as string;

      switch (entity) {
        case "target":
          return unwrapAction(updateAdTarget(id, args.name as string));
        case "solution": {
          if (args.text !== undefined) {
            return unwrapAction(
              updateAdSolution(id, args.text as string, args.targetIds as string[] | undefined)
            );
          }
          if (args.targetIds !== undefined) {
            return unwrapAction(updateSolutionTargets(id, args.targetIds as string[]));
          }
          if (args.destinationIds !== undefined) {
            return unwrapAction(
              updateSolutionDestinations(id, args.destinationIds as string[])
            );
          }
          throw new Error("Provide text, targetIds or destinationIds to update a solution");
        }
        case "riskReversal":
          return unwrapAction(updateAdRiskReversal(id, args.text as string));
        case "destination":
          return unwrapAction(
            updateAdDestination(id, args.label as string, args.url as string)
          );
        default:
          throw new Error(`Unknown ad entity: ${String(entity)}`);
      }
    },
  }),

  defineTool({
    name: "deleteAdEntity",
    label: "Delete Ad Building Block",
    risk: "destructive",
    description:
      "Delete an ad generator building block. Every permutation that uses it is deleted too.",
    parameters: {
      properties: {
        entity: {
          type: "string",
          enum: [...AD_ENTITIES],
          description: "Which ad building block to delete",
        },
        id: { type: "string", description: "The entity ID" },
      },
      required: ["entity", "id"],
    },
    preview: async (args) => ({
      title: `Delete ${entityLabel(args)}`,
      summary: `${entityLabel(args)} ${args.id} and every permutation using it will be deleted.`,
    }),
    execute: async (args) => {
      const entity = args.entity as AdEntity;
      const id = args.id as string;

      switch (entity) {
        case "target":
          return unwrapAction(deleteAdTarget(id));
        case "solution":
          return unwrapAction(deleteAdSolution(id));
        case "riskReversal":
          return unwrapAction(deleteAdRiskReversal(id));
        case "destination":
          return unwrapAction(deleteAdDestination(id));
        default:
          throw new Error(`Unknown ad entity: ${String(entity)}`);
      }
    },
  }),

  defineTool({
    name: "createAdPermutation",
    label: "Create Ad Permutation",
    risk: "additive",
    description: "Create a single ad permutation from a target, solution and risk reversal.",
    parameters: {
      properties: {
        targetId: { type: "string", description: "Target ID" },
        solutionId: { type: "string", description: "Solution ID" },
        riskReversalId: { type: "string", description: "Risk reversal ID" },
        destinationId: { type: "string", description: "Destination ID" },
        adHeadline: { type: "string", description: "Ad headline" },
        adPrimaryText: { type: "string", description: "Ad primary text" },
        adDescription: { type: "string", description: "Ad description" },
      },
      required: ["targetId", "solutionId", "riskReversalId"],
    },
    preview: async (args) => ({
      title: "Create ad permutation",
      summary: changeSummary(args),
    }),
    execute: async (args) =>
      unwrapAction(
        createAdPermutation({
          targetId: args.targetId as string,
          solutionId: args.solutionId as string,
          riskReversalId: args.riskReversalId as string,
          destinationId: args.destinationId as string | undefined,
          adHeadline: args.adHeadline as string | undefined,
          adPrimaryText: args.adPrimaryText as string | undefined,
          adDescription: args.adDescription as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "updateAdPermutation",
    label: "Update Ad Permutation",
    risk: "additive",
    description: "Update an ad permutation's copy or Meta tracking IDs.",
    parameters: {
      properties: {
        permutationId: { type: "string", description: "The permutation ID" },
        adHeadline: { type: "string", description: "New headline" },
        adPrimaryText: { type: "string", description: "New primary text" },
        adDescription: { type: "string", description: "New description" },
        metaAdId: { type: "string", description: "Meta ad ID" },
        metaAdUrl: { type: "string", description: "Meta ad URL" },
        metaCampaignId: { type: "string", description: "Meta campaign ID" },
        metaAdSetId: { type: "string", description: "Meta ad set ID" },
      },
      required: ["permutationId"],
    },
    preview: async (args) => ({
      title: "Update ad permutation",
      summary: `Permutation ${args.permutationId} — ${changeSummary(args, ["permutationId"])}`,
    }),
    execute: async (args) =>
      unwrapAction(
        updateAdPermutation(args.permutationId as string, {
          adHeadline: args.adHeadline as string | undefined,
          adPrimaryText: args.adPrimaryText as string | undefined,
          adDescription: args.adDescription as string | undefined,
          metaAdId: args.metaAdId as string | undefined,
          metaAdUrl: args.metaAdUrl as string | undefined,
          metaCampaignId: args.metaCampaignId as string | undefined,
          metaAdSetId: args.metaAdSetId as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "deleteAdPermutation",
    label: "Delete Ad Permutation",
    risk: "destructive",
    description: "Permanently delete a single ad permutation.",
    parameters: {
      properties: { permutationId: { type: "string", description: "The permutation ID" } },
      required: ["permutationId"],
    },
    preview: async (args) => ({
      title: "Delete ad permutation",
      summary: `Permutation ${args.permutationId} will be permanently deleted.`,
    }),
    execute: async (args) =>
      unwrapAction(deleteAdPermutation(args.permutationId as string)),
  }),

  defineTool({
    name: "deleteUnlinkedPermutations",
    label: "Delete Unlinked Permutations",
    risk: "destructive",
    description: "Bulk delete every permutation that has no Meta ad linked to it.",
    parameters: { properties: {} },
    preview: async () => ({
      title: "Delete unlinked permutations",
      summary: "Every permutation without a linked Meta ad will be deleted in bulk.",
    }),
    execute: async () => unwrapAction(deleteUnlinkedPermutations()),
  }),

  defineTool({
    name: "generateAllPermutations",
    label: "Generate All Permutations",
    risk: "additive",
    description:
      "Bulk create every missing combination of target, solution, risk reversal and destination.",
    parameters: { properties: {} },
    preview: async () => ({
      title: "Generate all permutations",
      summary:
        "Every missing combination of target, solution, risk reversal and destination will be created in bulk.",
    }),
    execute: async () => unwrapAction(generateAllPermutations()),
  }),
];
