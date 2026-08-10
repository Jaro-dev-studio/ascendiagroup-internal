import {
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  addWorkflowAttachment,
  removeWorkflowAttachment,
} from "@/lib/actions/workflows";
import { defineTool, type AITool } from "../types";
import { lookupEntityLabel } from "../preview";
import { changeSummary, deletePreview, unwrapAction } from "./helpers";

const TRIGGER_ENUM = ["CONDITION", "SCHEDULE", "WORKFLOW_COMPLETED"] as const;

export const workflowWriteTools: AITool[] = [
  defineTool({
    name: "createWorkflow",
    label: "Create Workflow",
    risk: "additive",
    description: "Create an internal workflow map.",
    parameters: {
      properties: {
        name: { type: "string", description: "Workflow name" },
        description: { type: "string", description: "Workflow description" },
        triggerType: {
          type: "string",
          enum: [...TRIGGER_ENUM],
          description: "What triggers this workflow",
        },
        triggerValue: { type: "string", description: "Trigger detail, e.g. a cron or event name" },
        triggeredByWorkflowId: {
          type: "string",
          description: "Workflow ID whose completion triggers this one",
        },
      },
      required: ["name", "triggerType"],
    },
    preview: async (args) => ({
      title: "Create workflow",
      summary: `"${args.name}" triggered by ${args.triggerType}`,
      details: { Description: (args.description as string) ?? "—" },
    }),
    execute: async (args) =>
      unwrapAction(
        createWorkflow({
          name: args.name as string,
          description: args.description as string | undefined,
          triggerType: args.triggerType as never,
          triggerValue: args.triggerValue as string | undefined,
          triggeredByWorkflowId: args.triggeredByWorkflowId as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "updateWorkflow",
    label: "Update Workflow",
    risk: "additive",
    description: "Update a workflow map's name, description or trigger.",
    parameters: {
      properties: {
        workflowId: { type: "string", description: "The workflow ID" },
        name: { type: "string", description: "New name" },
        description: { type: "string", description: "New description" },
        triggerType: { type: "string", enum: [...TRIGGER_ENUM], description: "New trigger type" },
        triggerValue: { type: "string", description: "New trigger detail" },
        triggeredByWorkflowId: { type: "string", description: "New upstream workflow ID" },
      },
      required: ["workflowId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("workflow", String(args.workflowId));
      return {
        title: "Update workflow",
        summary: `${label ? `"${label}"` : String(args.workflowId)} — ${changeSummary(args, ["workflowId"])}`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        updateWorkflow(args.workflowId as string, {
          name: args.name as string | undefined,
          description: args.description as string | undefined,
          triggerType: args.triggerType as never,
          triggerValue: args.triggerValue as string | undefined,
          triggeredByWorkflowId: args.triggeredByWorkflowId as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "deleteWorkflow",
    label: "Delete Workflow",
    risk: "destructive",
    description:
      "Permanently delete a workflow map and its uploaded attachments from blob storage.",
    parameters: {
      properties: { workflowId: { type: "string", description: "The workflow ID" } },
      required: ["workflowId"],
    },
    preview: deletePreview("workflow", "workflowId", "workflow"),
    execute: async (args) => unwrapAction(deleteWorkflow(args.workflowId as string)),
  }),

  defineTool({
    name: "addWorkflowAttachment",
    label: "Add Workflow Attachment",
    risk: "additive",
    description: "Attach an already-uploaded image or video URL to a workflow.",
    parameters: {
      properties: {
        workflowId: { type: "string", description: "The workflow ID" },
        url: { type: "string", description: "The file URL" },
        filename: { type: "string", description: "The display filename" },
        type: { type: "string", enum: ["image", "video"], description: "Attachment type" },
      },
      required: ["workflowId", "url", "filename", "type"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("workflow", String(args.workflowId));
      return {
        title: "Add workflow attachment",
        summary: `Attach "${args.filename}" to ${label ? `"${label}"` : String(args.workflowId)}.`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        addWorkflowAttachment(
          args.workflowId as string,
          args.url as string,
          args.filename as string,
          args.type as string
        )
      ),
  }),

  defineTool({
    name: "removeWorkflowAttachment",
    label: "Remove Workflow Attachment",
    risk: "destructive",
    description: "Delete a workflow attachment and remove the file from blob storage.",
    parameters: {
      properties: { attachmentId: { type: "string", description: "The attachment ID" } },
      required: ["attachmentId"],
    },
    preview: async (args) => ({
      title: "Remove workflow attachment",
      summary: `Attachment ${args.attachmentId} will be deleted from the workflow and from blob storage.`,
    }),
    execute: async (args) =>
      unwrapAction(removeWorkflowAttachment(args.attachmentId as string)),
  }),
];
