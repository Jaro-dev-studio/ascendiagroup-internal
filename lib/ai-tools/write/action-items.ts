import {
  createActionItem,
  updateActionItem,
  updateActionItemStatus,
  deleteActionItem,
} from "@/lib/actions";
import { defineTool, type AITool } from "../types";
import { lookupEntityLabel } from "../preview";
import { changeSummary, clientNameFor, deletePreview, unwrapAction } from "./helpers";

const PRIORITY_ENUM = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const STATUS_ENUM = ["PENDING_ADMIN_REVIEW", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

type ItemPriority = (typeof PRIORITY_ENUM)[number];
type ItemStatus = (typeof STATUS_ENUM)[number];

export const actionItemWriteTools: AITool[] = [
  defineTool({
    name: "createActionItem",
    label: "Create Action Item",
    risk: "additive",
    description:
      "Create a client-side action item. Resolve the client company ID with queryClients first.",
    parameters: {
      properties: {
        name: { type: "string", description: "Action item name" },
        description: { type: "string", description: "Description" },
        priority: { type: "string", enum: [...PRIORITY_ENUM], description: "Priority" },
        status: { type: "string", enum: [...STATUS_ENUM], description: "Initial status" },
        clientCompanyId: { type: "string", description: "Client company ID" },
      },
      required: ["name", "clientCompanyId"],
    },
    preview: async (args) => {
      const clientName = await clientNameFor(args.clientCompanyId);
      return {
        title: "Create action item",
        summary: `"${args.name}"${clientName ? ` for ${clientName}` : ""}`,
        details: {
          Priority: (args.priority as string) ?? "MEDIUM",
          Status: (args.status as string) ?? "TODO",
          Description: (args.description as string) ?? "—",
        },
      };
    },
    execute: async (args) =>
      unwrapAction(
        createActionItem({
          name: args.name as string,
          description: args.description as string | undefined,
          priority: (args.priority as ItemPriority) ?? "MEDIUM",
          status: (args.status as ItemStatus) ?? "TODO",
          clientCompanyId: args.clientCompanyId as string,
        })
      ),
  }),

  defineTool({
    name: "updateActionItem",
    label: "Update Action Item",
    risk: "additive",
    description: "Update an action item. Only the fields you provide are changed.",
    parameters: {
      properties: {
        actionItemId: { type: "string", description: "The action item ID" },
        name: { type: "string", description: "New name" },
        description: { type: "string", description: "New description" },
        priority: { type: "string", enum: [...PRIORITY_ENUM], description: "New priority" },
        status: { type: "string", enum: [...STATUS_ENUM], description: "New status" },
        clientCompanyId: { type: "string", description: "New client company ID" },
      },
      required: ["actionItemId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("actionItem", String(args.actionItemId));
      return {
        title: "Update action item",
        summary: `${label ? `"${label}"` : String(args.actionItemId)} — ${changeSummary(args, ["actionItemId"])}`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        updateActionItem(args.actionItemId as string, {
          name: args.name as string | undefined,
          description: args.description as string | undefined,
          priority: args.priority as ItemPriority | undefined,
          status: args.status as ItemStatus | undefined,
          clientCompanyId: args.clientCompanyId as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "setActionItemStatus",
    label: "Set Action Item Status",
    risk: "additive",
    description:
      "Change only the status of an action item, for example clearing PENDING_ADMIN_REVIEW or marking it DONE.",
    parameters: {
      properties: {
        actionItemId: { type: "string", description: "The action item ID" },
        status: { type: "string", enum: [...STATUS_ENUM], description: "The new status" },
      },
      required: ["actionItemId", "status"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("actionItem", String(args.actionItemId));
      return {
        title: "Set action item status",
        summary: `${label ? `"${label}"` : String(args.actionItemId)} → ${args.status}`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        updateActionItemStatus(args.actionItemId as string, args.status as ItemStatus)
      ),
  }),

  defineTool({
    name: "deleteActionItem",
    label: "Delete Action Item",
    risk: "destructive",
    description: "Permanently delete an action item.",
    parameters: {
      properties: { actionItemId: { type: "string", description: "The action item ID" } },
      required: ["actionItemId"],
    },
    preview: deletePreview("actionItem", "actionItemId", "action item"),
    execute: async (args) => unwrapAction(deleteActionItem(args.actionItemId as string)),
  }),
];
