import {
  createFollowupTemplate,
  updateFollowupTemplate,
  deleteFollowupTemplate,
  generateFollowup,
  updateFollowupContent,
  sendFollowup,
  deleteFollowup,
} from "@/lib/actions/followups";
import { defineTool, type AITool } from "../types";
import { lookupEntityLabel } from "../preview";
import { deletePreview, unwrapAction } from "./helpers";

export const followupWriteTools: AITool[] = [
  defineTool({
    name: "createFollowupTemplate",
    label: "Create Followup Template",
    risk: "additive",
    description: "Create a followup template with AI instructions used against call transcripts.",
    parameters: {
      properties: {
        name: { type: "string", description: "Template name" },
        prompt: { type: "string", description: "AI instructions for generating the followup" },
      },
      required: ["name", "prompt"],
    },
    preview: async (args) => ({
      title: "Create followup template",
      summary: `"${args.name}"`,
      details: { Prompt: String(args.prompt).slice(0, 300) },
    }),
    execute: async (args) =>
      unwrapAction(
        createFollowupTemplate({ name: args.name as string, prompt: args.prompt as string })
      ),
  }),

  defineTool({
    name: "updateFollowupTemplate",
    label: "Update Followup Template",
    risk: "additive",
    description: "Replace a followup template's name and prompt.",
    parameters: {
      properties: {
        templateId: { type: "string", description: "The template ID" },
        name: { type: "string", description: "New name" },
        prompt: { type: "string", description: "New prompt" },
      },
      required: ["templateId", "name", "prompt"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("followupTemplate", String(args.templateId));
      return {
        title: "Update followup template",
        summary: `${label ? `"${label}"` : String(args.templateId)} → "${args.name}"`,
        details: { Prompt: String(args.prompt).slice(0, 300) },
      };
    },
    execute: async (args) =>
      unwrapAction(
        updateFollowupTemplate(args.templateId as string, {
          name: args.name as string,
          prompt: args.prompt as string,
        })
      ),
  }),

  defineTool({
    name: "deleteFollowupTemplate",
    label: "Delete Followup Template",
    risk: "destructive",
    description: "Permanently delete a followup template and every followup generated from it.",
    parameters: {
      properties: { templateId: { type: "string", description: "The template ID" } },
      required: ["templateId"],
    },
    preview: deletePreview("followupTemplate", "templateId", "followup template"),
    execute: async (args) =>
      unwrapAction(deleteFollowupTemplate(args.templateId as string)),
  }),

  defineTool({
    name: "generateFollowup",
    label: "Generate Followup",
    risk: "additive",
    description:
      "Generate a followup draft for a call using a template. The draft is saved but not sent.",
    parameters: {
      properties: {
        meetingId: { type: "string", description: "The meeting/call ID" },
        templateId: { type: "string", description: "The followup template ID" },
      },
      required: ["meetingId", "templateId"],
    },
    preview: async (args) => {
      const meeting = await lookupEntityLabel("meeting", String(args.meetingId));
      const template = await lookupEntityLabel("followupTemplate", String(args.templateId));
      return {
        title: "Generate followup",
        summary: `Draft a followup for ${meeting ? `"${meeting}"` : String(args.meetingId)} using ${template ? `"${template}"` : String(args.templateId)}. Nothing is emailed.`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        generateFollowup(args.meetingId as string, args.templateId as string)
      ),
  }),

  defineTool({
    name: "updateFollowupContent",
    label: "Update Followup Content",
    risk: "additive",
    description: "Replace the content of a generated followup draft.",
    parameters: {
      properties: {
        followupId: { type: "string", description: "The followup ID" },
        content: { type: "string", description: "The new content" },
      },
      required: ["followupId", "content"],
    },
    preview: async (args) => {
      const content = String(args.content);
      return {
        title: "Update followup content",
        summary: `Followup ${args.followupId} will be replaced with ${content.length} characters.`,
        details: { Preview: `${content.slice(0, 300)}${content.length > 300 ? "..." : ""}` },
      };
    },
    execute: async (args) =>
      unwrapAction(
        updateFollowupContent(args.followupId as string, args.content as string)
      ),
  }),

  defineTool({
    name: "sendFollowup",
    label: "Send Followup Email",
    risk: "destructive",
    description:
      "Email a followup to a recipient. The email is sent immediately and cannot be recalled.",
    parameters: {
      properties: {
        followupId: { type: "string", description: "The followup ID" },
        recipientEmail: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject" },
      },
      required: ["followupId", "recipientEmail", "subject"],
    },
    preview: async (args) => ({
      title: "Send followup email",
      summary: `An email titled "${args.subject}" will be sent to ${args.recipientEmail} immediately and cannot be recalled.`,
    }),
    execute: async (args) =>
      unwrapAction(
        sendFollowup(
          args.followupId as string,
          args.recipientEmail as string,
          args.subject as string
        )
      ),
  }),

  defineTool({
    name: "deleteFollowup",
    label: "Delete Followup",
    risk: "destructive",
    description: "Permanently delete a generated followup.",
    parameters: {
      properties: { followupId: { type: "string", description: "The followup ID" } },
      required: ["followupId"],
    },
    preview: async (args) => ({
      title: "Delete followup",
      summary: `Followup ${args.followupId} will be permanently deleted. This cannot be undone.`,
    }),
    execute: async (args) => unwrapAction(deleteFollowup(args.followupId as string)),
  }),
];
