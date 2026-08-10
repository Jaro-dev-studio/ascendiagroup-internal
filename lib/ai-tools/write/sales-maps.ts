import {
  createSalesCallMap,
  updateSalesCallMap,
  deleteSalesCallMap,
  deleteSharedQuote,
  createMVPCallMap,
  updateMVPCallMap,
  deleteMVPCallMap,
  deleteMVPSharedQuote,
} from "@/lib/actions";
import { defineTool, type AITool } from "../types";
import { lookupEntityLabel } from "../preview";
import { changeSummary, deletePreview, unwrapAction } from "./helpers";

export const salesMapWriteTools: AITool[] = [
  defineTool({
    name: "createSalesCallMap",
    label: "Create Sales Call Map",
    risk: "additive",
    description: "Create an ops-audit sales call map.",
    parameters: {
      properties: {
        name: { type: "string", description: "Map name" },
        notes: { type: "string", description: "Notes" },
        clientCompanyId: { type: "string", description: "Linked client company ID" },
        meetingId: { type: "string", description: "Linked meeting ID" },
        formSubmissionId: { type: "string", description: "Linked form submission ID" },
      },
      required: ["name"],
    },
    preview: async (args) => ({
      title: "Create sales call map",
      summary: `"${args.name}"`,
      details: { Notes: (args.notes as string) ?? "—" },
    }),
    execute: async (args) =>
      unwrapAction(
        createSalesCallMap({
          name: args.name as string,
          notes: args.notes as string | undefined,
          clientCompanyId: args.clientCompanyId as string | undefined,
          meetingId: args.meetingId as string | undefined,
          formSubmissionId: args.formSubmissionId as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "updateSalesCallMap",
    label: "Update Sales Call Map",
    risk: "additive",
    description: "Update a sales call map's name, notes or linked records.",
    parameters: {
      properties: {
        salesCallMapId: { type: "string", description: "The sales call map ID" },
        name: { type: "string", description: "New name" },
        notes: { type: "string", description: "New notes" },
        clientCompanyId: { type: "string", description: "New client company ID" },
        meetingId: { type: "string", description: "New meeting ID" },
        formSubmissionId: { type: "string", description: "New form submission ID" },
      },
      required: ["salesCallMapId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("salesCallMap", String(args.salesCallMapId));
      return {
        title: "Update sales call map",
        summary: `${label ? `"${label}"` : String(args.salesCallMapId)} — ${changeSummary(args, ["salesCallMapId"])}`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        updateSalesCallMap(args.salesCallMapId as string, {
          name: args.name as string | undefined,
          notes: args.notes as string | undefined,
          clientCompanyId: args.clientCompanyId as string | undefined,
          meetingId: args.meetingId as string | undefined,
          formSubmissionId: args.formSubmissionId as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "deleteSalesCallMap",
    label: "Delete Sales Call Map",
    risk: "destructive",
    description: "Permanently delete a sales call map and its shared quotes.",
    parameters: {
      properties: { salesCallMapId: { type: "string", description: "The sales call map ID" } },
      required: ["salesCallMapId"],
    },
    preview: deletePreview("salesCallMap", "salesCallMapId", "sales call map"),
    execute: async (args) =>
      unwrapAction(deleteSalesCallMap(args.salesCallMapId as string)),
  }),

  defineTool({
    name: "deleteSharedQuote",
    label: "Delete Shared Quote",
    risk: "destructive",
    description:
      "Permanently delete a shared quote. Any public link to that quote stops working immediately.",
    parameters: {
      properties: {
        quoteId: { type: "string", description: "The shared quote ID" },
        salesCallMapId: { type: "string", description: "The parent sales call map ID" },
      },
      required: ["quoteId", "salesCallMapId"],
    },
    preview: async (args) => ({
      title: "Delete shared quote",
      summary: `Quote ${args.quoteId} will be deleted and its public link will stop working.`,
    }),
    execute: async (args) =>
      unwrapAction(
        deleteSharedQuote(args.quoteId as string, args.salesCallMapId as string)
      ),
  }),

  defineTool({
    name: "createMvpCallMap",
    label: "Create MVP Call Map",
    risk: "additive",
    description: "Create an MVP product builder call map.",
    parameters: {
      properties: {
        name: { type: "string", description: "Map name" },
        notes: { type: "string", description: "Notes" },
        clientCompanyId: { type: "string", description: "Linked client company ID" },
        formSubmissionId: { type: "string", description: "Linked form submission ID" },
      },
      required: ["name"],
    },
    preview: async (args) => ({
      title: "Create MVP call map",
      summary: `"${args.name}"`,
      details: { Notes: (args.notes as string) ?? "—" },
    }),
    execute: async (args) =>
      unwrapAction(
        createMVPCallMap({
          name: args.name as string,
          notes: args.notes as string | undefined,
          clientCompanyId: args.clientCompanyId as string | undefined,
          formSubmissionId: args.formSubmissionId as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "updateMvpCallMap",
    label: "Update MVP Call Map",
    risk: "additive",
    description: "Update an MVP call map's name, notes or linked records.",
    parameters: {
      properties: {
        mvpCallMapId: { type: "string", description: "The MVP call map ID" },
        name: { type: "string", description: "New name" },
        notes: { type: "string", description: "New notes" },
        clientCompanyId: { type: "string", description: "New client company ID" },
        formSubmissionId: { type: "string", description: "New form submission ID" },
      },
      required: ["mvpCallMapId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("mvpCallMap", String(args.mvpCallMapId));
      return {
        title: "Update MVP call map",
        summary: `${label ? `"${label}"` : String(args.mvpCallMapId)} — ${changeSummary(args, ["mvpCallMapId"])}`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        updateMVPCallMap(args.mvpCallMapId as string, {
          name: args.name as string | undefined,
          notes: args.notes as string | undefined,
          clientCompanyId: args.clientCompanyId as string | undefined,
          formSubmissionId: args.formSubmissionId as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "deleteMvpCallMap",
    label: "Delete MVP Call Map",
    risk: "destructive",
    description: "Permanently delete an MVP call map and its shared quotes.",
    parameters: {
      properties: { mvpCallMapId: { type: "string", description: "The MVP call map ID" } },
      required: ["mvpCallMapId"],
    },
    preview: deletePreview("mvpCallMap", "mvpCallMapId", "MVP call map"),
    execute: async (args) => unwrapAction(deleteMVPCallMap(args.mvpCallMapId as string)),
  }),

  defineTool({
    name: "deleteMvpSharedQuote",
    label: "Delete MVP Shared Quote",
    risk: "destructive",
    description:
      "Permanently delete an MVP shared quote. Any public link to that quote stops working immediately.",
    parameters: {
      properties: {
        quoteId: { type: "string", description: "The MVP shared quote ID" },
        mvpCallMapId: { type: "string", description: "The parent MVP call map ID" },
      },
      required: ["quoteId", "mvpCallMapId"],
    },
    preview: async (args) => ({
      title: "Delete MVP shared quote",
      summary: `Quote ${args.quoteId} will be deleted and its public link will stop working.`,
    }),
    execute: async (args) =>
      unwrapAction(
        deleteMVPSharedQuote(args.quoteId as string, args.mvpCallMapId as string)
      ),
  }),
];
