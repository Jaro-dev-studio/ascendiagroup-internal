import {
  createClientCompany,
  updateClientCompany,
  deleteClientCompany,
  updateNotificationConfig,
  testNotification,
} from "@/lib/actions";
import { defineTool, type AITool } from "../types";
import { lookupEntityLabel } from "../preview";
import { changeSummary, deletePreview, unwrapAction } from "./helpers";

const NOTIFICATION_EVENT_ENUM = [
  "ACTION_ITEM_CREATED",
  "TASK_COMPLETED",
  "ACTION_ITEM_COMPLETED",
  "TASK_UNBLOCKED",
  "FEATURE_REQUESTED",
  "BUG_REQUESTED",
] as const;

type NotificationEvent = (typeof NOTIFICATION_EVENT_ENUM)[number];

export const clientWriteTools: AITool[] = [
  defineTool({
    name: "createClientCompany",
    label: "Create Client Company",
    risk: "additive",
    description: "Create a new client company.",
    parameters: {
      properties: { name: { type: "string", description: "Company name" } },
      required: ["name"],
    },
    preview: async (args) => ({
      title: "Create client company",
      summary: `A new client company "${args.name}" will be created.`,
    }),
    execute: async (args) => unwrapAction(createClientCompany({ name: args.name as string })),
  }),

  defineTool({
    name: "updateClientCompany",
    label: "Update Client Company",
    risk: "additive",
    description:
      "Update a client company's name or Slack channel IDs. Only the fields you provide are changed. Pipeline status is derived from the company's deals and cannot be set here; move the deal to a different stage instead.",
    parameters: {
      properties: {
        clientCompanyId: { type: "string", description: "The client company ID" },
        name: { type: "string", description: "New name" },
        slackPublicChannelId: { type: "string", description: "Client-facing Slack channel ID" },
        slackInternalChannelId: { type: "string", description: "Internal Slack channel ID" },
      },
      required: ["clientCompanyId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("company", String(args.clientCompanyId));
      return {
        title: "Update client company",
        summary: `${label ? `"${label}"` : String(args.clientCompanyId)} — ${changeSummary(args, ["clientCompanyId"])}`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        updateClientCompany(args.clientCompanyId as string, {
          name: args.name as string | undefined,
          slackPublicChannelId: args.slackPublicChannelId as string | undefined,
          slackInternalChannelId: args.slackInternalChannelId as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "deleteClientCompany",
    label: "Delete Client Company",
    risk: "destructive",
    description:
      "Permanently delete a client company. This affects every record linked to that client.",
    parameters: {
      properties: { clientCompanyId: { type: "string", description: "The client company ID" } },
      required: ["clientCompanyId"],
    },
    preview: deletePreview("company", "clientCompanyId", "client company"),
    execute: async (args) =>
      unwrapAction(deleteClientCompany(args.clientCompanyId as string)),
  }),

  defineTool({
    name: "updateNotificationConfig",
    label: "Update Notification Config",
    risk: "additive",
    description:
      "Set whether a Slack notification event is sent to the client-facing channel, the internal channel, or both.",
    parameters: {
      properties: {
        clientCompanyId: { type: "string", description: "The client company ID" },
        eventType: {
          type: "string",
          enum: [...NOTIFICATION_EVENT_ENUM],
          description: "Which event to configure",
        },
        sendToPublic: { type: "boolean", description: "Send to the client-facing channel" },
        sendToInternal: { type: "boolean", description: "Send to the internal channel" },
      },
      required: ["clientCompanyId", "eventType", "sendToPublic", "sendToInternal"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("company", String(args.clientCompanyId));
      const targets = [
        args.sendToPublic ? "client channel" : null,
        args.sendToInternal ? "internal channel" : null,
      ].filter(Boolean);
      return {
        title: "Update notification config",
        summary: `${args.eventType} for ${label ?? String(args.clientCompanyId)} → ${targets.length ? targets.join(" + ") : "no channels"}`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        updateNotificationConfig(
          args.clientCompanyId as string,
          args.eventType as NotificationEvent,
          args.sendToPublic as boolean,
          args.sendToInternal as boolean
        )
      ),
  }),

  defineTool({
    name: "testNotification",
    label: "Send Test Notification",
    risk: "destructive",
    description:
      "Send a real test Slack message for an event type to the configured channels.",
    parameters: {
      properties: {
        clientCompanyId: { type: "string", description: "The client company ID" },
        eventType: {
          type: "string",
          enum: [...NOTIFICATION_EVENT_ENUM],
          description: "Which event to simulate",
        },
      },
      required: ["clientCompanyId", "eventType"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("company", String(args.clientCompanyId));
      return {
        title: "Send test Slack notification",
        summary: `A real Slack message for ${args.eventType} will be posted to ${label ?? String(args.clientCompanyId)}'s configured channels.`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        testNotification(args.clientCompanyId as string, args.eventType as NotificationEvent)
      ),
  }),
];
