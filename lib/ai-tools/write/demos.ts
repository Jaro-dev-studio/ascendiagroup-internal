import {
  approveProductBuild,
  rejectProductBuild,
  queueProductBuildFromMeeting,
  updateDemo,
  deleteDemo,
  deleteDemoWithCleanup,
  regenerateDemo,
} from "@/lib/actions";
import { defineTool, type AITool } from "../types";
import { lookupEntityLabel } from "../preview";
import { deletePreview, unwrapAction } from "./helpers";

export const demoWriteTools: AITool[] = [
  defineTool({
    name: "approveProductBuild",
    label: "Approve Product Build",
    risk: "destructive",
    description:
      "Approve a queued product build. This provisions a GitHub repository and Vercel project and starts a Cursor cloud agent.",
    parameters: {
      properties: {
        demoId: { type: "string", description: "The demo/build ID" },
        templateRepo: { type: "string", description: "Template repository to build from" },
        additionalContext: { type: "string", description: "Extra prompt context for the agent" },
        mvpCallMapId: {
          type: "string",
          description:
            "MVP call map to include as the scoped product specification in the agent prompt",
        },
      },
      required: ["demoId", "templateRepo"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("demo", String(args.demoId));
      const callMapLabel = args.mvpCallMapId
        ? await lookupEntityLabel("mvpCallMap", String(args.mvpCallMapId))
        : null;
      return {
        title: "Approve product build",
        summary: `${label ? `"${label}"` : String(args.demoId)} will be built from ${args.templateRepo}. This creates a GitHub repo, a Vercel project and starts a Cursor agent.`,
        details: {
          Context: (args.additionalContext as string) ?? "—",
          "MVP call map": callMapLabel ?? (args.mvpCallMapId as string) ?? "—",
        },
      };
    },
    execute: async (args) =>
      unwrapAction(
        approveProductBuild(args.demoId as string, {
          templateRepo: args.templateRepo as string,
          additionalContext: args.additionalContext as string | undefined,
          mvpCallMapId: args.mvpCallMapId as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "rejectProductBuild",
    label: "Reject Product Build",
    risk: "additive",
    description: "Reject a queued product build with an optional reason.",
    parameters: {
      properties: {
        demoId: { type: "string", description: "The demo/build ID" },
        reason: { type: "string", description: "Why the build was rejected" },
      },
      required: ["demoId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("demo", String(args.demoId));
      return {
        title: "Reject product build",
        summary: `${label ? `"${label}"` : String(args.demoId)} will be marked rejected.`,
        details: { Reason: (args.reason as string) ?? "—" },
      };
    },
    execute: async (args) =>
      unwrapAction(
        rejectProductBuild(args.demoId as string, args.reason as string | undefined)
      ),
  }),

  defineTool({
    name: "queueProductBuildFromMeeting",
    label: "Queue Product Build From Call",
    risk: "additive",
    description:
      "Queue a product build from a call transcript. The build waits for approval before anything is provisioned.",
    parameters: {
      properties: {
        meetingId: { type: "string", description: "The meeting/call ID" },
        clientCompanyId: { type: "string", description: "Override the client company ID" },
      },
      required: ["meetingId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("meeting", String(args.meetingId));
      return {
        title: "Queue product build",
        summary: `Queue a build from ${label ? `"${label}"` : String(args.meetingId)}. It will await approval before provisioning.`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        queueProductBuildFromMeeting(
          args.meetingId as string,
          args.clientCompanyId as string | undefined
        )
      ),
  }),

  defineTool({
    name: "updateDemo",
    label: "Rename Product Build",
    risk: "additive",
    description: "Rename a demo / product build.",
    parameters: {
      properties: {
        demoId: { type: "string", description: "The demo ID" },
        name: { type: "string", description: "The new name" },
      },
      required: ["demoId", "name"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("demo", String(args.demoId));
      return {
        title: "Rename product build",
        summary: `${label ? `"${label}"` : String(args.demoId)} → "${args.name}"`,
      };
    },
    execute: async (args) =>
      unwrapAction(updateDemo(args.demoId as string, { name: args.name as string })),
  }),

  defineTool({
    name: "regenerateDemo",
    label: "Regenerate Product Build",
    risk: "destructive",
    description:
      "Relaunch the Cursor agent on an existing build. This overwrites work in the connected repository.",
    parameters: {
      properties: { demoId: { type: "string", description: "The demo ID" } },
      required: ["demoId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("demo", String(args.demoId));
      return {
        title: "Regenerate product build",
        summary: `A new Cursor agent run will start for ${label ? `"${label}"` : String(args.demoId)} and overwrite work in its repository.`,
      };
    },
    execute: async (args) => unwrapAction(regenerateDemo(args.demoId as string)),
  }),

  defineTool({
    name: "deleteDemo",
    label: "Delete Product Build Record",
    risk: "destructive",
    description:
      "Delete the demo record only, leaving its GitHub repo and Vercel project untouched.",
    parameters: {
      properties: { demoId: { type: "string", description: "The demo ID" } },
      required: ["demoId"],
    },
    preview: deletePreview("demo", "demoId", "product build record"),
    execute: async (args) => unwrapAction(deleteDemo(args.demoId as string)),
  }),

  defineTool({
    name: "deleteDemoWithCleanup",
    label: "Delete Product Build And Resources",
    risk: "destructive",
    description:
      "Delete a demo and optionally destroy its GitHub repository and Vercel project. External resources cannot be recovered.",
    parameters: {
      properties: {
        demoId: { type: "string", description: "The demo ID" },
        deleteGitHub: { type: "boolean", description: "Also delete the GitHub repository" },
        deleteVercel: { type: "boolean", description: "Also delete the Vercel project" },
      },
      required: ["demoId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("demo", String(args.demoId));
      const targets = [
        args.deleteGitHub ? "GitHub repository" : null,
        args.deleteVercel ? "Vercel project" : null,
      ].filter(Boolean);
      return {
        title: "Delete product build and resources",
        summary: `${label ? `"${label}"` : String(args.demoId)} will be deleted${targets.length ? `, along with its ${targets.join(" and ")}` : ""}. External resources cannot be recovered.`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        deleteDemoWithCleanup(args.demoId as string, {
          deleteGitHub: args.deleteGitHub as boolean | undefined,
          deleteVercel: args.deleteVercel as boolean | undefined,
        })
      ),
  }),
];
