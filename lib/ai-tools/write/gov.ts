import {
  createGovContract,
  updateGovContract,
  advanceGovContractStatus,
  revertGovContractStatus,
  setGovContractOutcome,
  deleteGovContract,
  createGovContractContact,
  updateGovContractContact,
  deleteGovContractContact,
  addGovContractNote,
  saveGovContractDocument,
  importOpportunityToContract,
  dismissOpportunity,
  undismissOpportunity,
  reanalyzeOpportunity,
  syncSamOpportunities,
  syncUsaSpending,
} from "@/lib/actions";
import { defineTool, type AITool } from "../types";
import { lookupEntityLabel } from "../preview";
import { changeSummary, deletePreview, toDate, unwrapAction } from "./helpers";

const SET_ASIDE_ENUM = [
  "SMALL_BUSINESS",
  "EIGHT_A",
  "HUBZONE",
  "SDVOSB",
  "WOSB",
  "FULL_AND_OPEN",
  "OTHER",
] as const;

const CONTACT_ROLE_ENUM = [
  "CONTRACTING_OFFICER",
  "PROGRAM_MANAGER",
  "TECHNICAL_POC",
  "SMALL_BUSINESS_REP",
  "INTERNAL",
  "OTHER",
] as const;

const DOCUMENT_TYPE_ENUM = [
  "callScript",
  "sourcesResponseContent",
  "proposalContent",
  "goNoGoNotes",
] as const;

type SetAside = (typeof SET_ASIDE_ENUM)[number];
type ContactRole = (typeof CONTACT_ROLE_ENUM)[number];
type DocumentType = (typeof DOCUMENT_TYPE_ENUM)[number];

export const govWriteTools: AITool[] = [
  defineTool({
    name: "createGovContract",
    label: "Create Gov Contract",
    risk: "additive",
    description: "Add a government contract opportunity to the pipeline.",
    parameters: {
      properties: {
        title: { type: "string", description: "Contract title" },
        agency: { type: "string", description: "Contracting agency" },
        subAgency: { type: "string", description: "Sub-agency" },
        solicitationNumber: { type: "string", description: "Solicitation number" },
        naicsCode: { type: "string", description: "NAICS code" },
        setAsideType: { type: "string", enum: [...SET_ASIDE_ENUM], description: "Set-aside type" },
        estimatedValue: { type: "number", description: "Estimated contract value in USD" },
        responseDeadline: { type: "string", description: "Response deadline as an ISO date" },
        placeOfPerformance: { type: "string", description: "Place of performance" },
        description: { type: "string", description: "Description" },
        samGovUrl: { type: "string", description: "SAM.gov listing URL" },
        notes: { type: "string", description: "Internal notes" },
      },
      required: ["title", "agency"],
    },
    preview: async (args) => ({
      title: "Create gov contract",
      summary: `"${args.title}" (${args.agency})`,
      details: {
        "Estimated value": args.estimatedValue ?? "—",
        Deadline: (args.responseDeadline as string) ?? "—",
      },
    }),
    execute: async (args) =>
      unwrapAction(
        createGovContract({
          title: args.title as string,
          agency: args.agency as string,
          subAgency: args.subAgency as string | undefined,
          solicitationNumber: args.solicitationNumber as string | undefined,
          naicsCode: args.naicsCode as string | undefined,
          setAsideType: args.setAsideType as SetAside | undefined,
          estimatedValue: args.estimatedValue as number | undefined,
          responseDeadline: toDate(args.responseDeadline),
          placeOfPerformance: args.placeOfPerformance as string | undefined,
          description: args.description as string | undefined,
          samGovUrl: args.samGovUrl as string | undefined,
          notes: args.notes as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "updateGovContract",
    label: "Update Gov Contract",
    risk: "additive",
    description: "Update a government contract. Only the fields you provide are changed.",
    parameters: {
      properties: {
        govContractId: { type: "string", description: "The contract ID" },
        title: { type: "string", description: "New title" },
        agency: { type: "string", description: "New agency" },
        subAgency: { type: "string", description: "New sub-agency" },
        solicitationNumber: { type: "string", description: "New solicitation number" },
        naicsCode: { type: "string", description: "New NAICS code" },
        setAsideType: { type: "string", enum: [...SET_ASIDE_ENUM], description: "New set-aside" },
        estimatedValue: { type: "number", description: "New estimated value" },
        awardAmount: { type: "number", description: "Award amount" },
        responseDeadline: { type: "string", description: "New response deadline (ISO date)" },
        expectedSolicitationDate: { type: "string", description: "Expected solicitation date (ISO)" },
        awardDate: { type: "string", description: "Award date (ISO date)" },
        placeOfPerformance: { type: "string", description: "New place of performance" },
        description: { type: "string", description: "New description" },
        samGovUrl: { type: "string", description: "New SAM.gov URL" },
        notes: { type: "string", description: "New internal notes" },
        goNoGoNotes: { type: "string", description: "Go/no-go notes" },
      },
      required: ["govContractId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("govContract", String(args.govContractId));
      return {
        title: "Update gov contract",
        summary: `${label ? `"${label}"` : String(args.govContractId)} — ${changeSummary(args, ["govContractId", "description"])}`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        updateGovContract(args.govContractId as string, {
          title: args.title as string | undefined,
          agency: args.agency as string | undefined,
          subAgency: args.subAgency as string | undefined,
          solicitationNumber: args.solicitationNumber as string | undefined,
          naicsCode: args.naicsCode as string | undefined,
          setAsideType: args.setAsideType as SetAside | undefined,
          estimatedValue: args.estimatedValue as number | undefined,
          awardAmount: args.awardAmount as number | undefined,
          responseDeadline: toDate(args.responseDeadline),
          expectedSolicitationDate: toDate(args.expectedSolicitationDate),
          awardDate: toDate(args.awardDate),
          placeOfPerformance: args.placeOfPerformance as string | undefined,
          description: args.description as string | undefined,
          samGovUrl: args.samGovUrl as string | undefined,
          notes: args.notes as string | undefined,
          goNoGoNotes: args.goNoGoNotes as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "advanceGovContractStatus",
    label: "Advance Gov Contract",
    risk: "additive",
    description:
      "Move a government contract to the next pipeline stage. This can also create a linked follow-up task.",
    parameters: {
      properties: {
        govContractId: { type: "string", description: "The contract ID" },
        expectedSolicitationDate: {
          type: "string",
          description: "Expected solicitation date (ISO) when advancing to awaiting solicitation",
        },
      },
      required: ["govContractId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("govContract", String(args.govContractId));
      return {
        title: "Advance gov contract",
        summary: `${label ? `"${label}"` : String(args.govContractId)} moves to the next pipeline stage.`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        advanceGovContractStatus(
          args.govContractId as string,
          toDate(args.expectedSolicitationDate)
        )
      ),
  }),

  defineTool({
    name: "revertGovContractStatus",
    label: "Revert Gov Contract",
    risk: "additive",
    description: "Move a government contract back one pipeline stage.",
    parameters: {
      properties: { govContractId: { type: "string", description: "The contract ID" } },
      required: ["govContractId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("govContract", String(args.govContractId));
      return {
        title: "Revert gov contract",
        summary: `${label ? `"${label}"` : String(args.govContractId)} moves back one pipeline stage.`,
      };
    },
    execute: async (args) =>
      unwrapAction(revertGovContractStatus(args.govContractId as string)),
  }),

  defineTool({
    name: "setGovContractOutcome",
    label: "Set Gov Contract Outcome",
    risk: "additive",
    description: "Mark a government contract as won or lost.",
    parameters: {
      properties: {
        govContractId: { type: "string", description: "The contract ID" },
        outcome: { type: "string", enum: ["WON", "LOST"], description: "The final outcome" },
        awardAmount: { type: "number", description: "Award amount when won" },
        awardDate: { type: "string", description: "Award date as an ISO date" },
      },
      required: ["govContractId", "outcome"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("govContract", String(args.govContractId));
      return {
        title: "Set gov contract outcome",
        summary: `${label ? `"${label}"` : String(args.govContractId)} → ${args.outcome}`,
        details: { "Award amount": args.awardAmount ?? "—" },
      };
    },
    execute: async (args) =>
      unwrapAction(
        setGovContractOutcome(
          args.govContractId as string,
          args.outcome as "WON" | "LOST",
          args.awardAmount as number | undefined,
          toDate(args.awardDate)
        )
      ),
  }),

  defineTool({
    name: "deleteGovContract",
    label: "Delete Gov Contract",
    risk: "destructive",
    description: "Permanently delete a government contract with its contacts and activity history.",
    parameters: {
      properties: { govContractId: { type: "string", description: "The contract ID" } },
      required: ["govContractId"],
    },
    preview: deletePreview("govContract", "govContractId", "government contract"),
    execute: async (args) => unwrapAction(deleteGovContract(args.govContractId as string)),
  }),

  defineTool({
    name: "addGovContractNote",
    label: "Add Gov Contract Note",
    risk: "additive",
    description: "Add a note to a government contract's activity timeline.",
    parameters: {
      properties: {
        govContractId: { type: "string", description: "The contract ID" },
        description: { type: "string", description: "The note text" },
      },
      required: ["govContractId", "description"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("govContract", String(args.govContractId));
      return {
        title: "Add gov contract note",
        summary: `Add a note to ${label ? `"${label}"` : String(args.govContractId)}.`,
        details: { Note: String(args.description) },
      };
    },
    execute: async (args) =>
      unwrapAction(
        addGovContractNote(args.govContractId as string, args.description as string)
      ),
  }),

  defineTool({
    name: "saveGovContractDocument",
    label: "Save Gov Contract Document",
    risk: "additive",
    description:
      "Save generated document content onto a contract, replacing whatever is currently stored for that document type.",
    parameters: {
      properties: {
        govContractId: { type: "string", description: "The contract ID" },
        documentType: {
          type: "string",
          enum: [...DOCUMENT_TYPE_ENUM],
          description: "Which document to overwrite",
        },
        content: { type: "string", description: "The document content" },
      },
      required: ["govContractId", "documentType", "content"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("govContract", String(args.govContractId));
      const content = String(args.content);
      return {
        title: "Save gov contract document",
        summary: `Replace the ${args.documentType} on ${label ? `"${label}"` : String(args.govContractId)} with ${content.length} characters.`,
        details: { Preview: `${content.slice(0, 300)}${content.length > 300 ? "..." : ""}` },
      };
    },
    execute: async (args) =>
      unwrapAction(
        saveGovContractDocument(
          args.govContractId as string,
          args.documentType as DocumentType,
          args.content as string
        )
      ),
  }),

  defineTool({
    name: "createGovContractContact",
    label: "Add Gov Contract Contact",
    risk: "additive",
    description: "Add a point of contact to a government contract.",
    parameters: {
      properties: {
        govContractId: { type: "string", description: "The contract ID" },
        name: { type: "string", description: "Contact name" },
        title: { type: "string", description: "Job title" },
        email: { type: "string", description: "Email address" },
        phone: { type: "string", description: "Phone number" },
        organization: { type: "string", description: "Organization" },
        role: { type: "string", enum: [...CONTACT_ROLE_ENUM], description: "Contact role" },
        notes: { type: "string", description: "Notes" },
      },
      required: ["govContractId", "name", "role"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("govContract", String(args.govContractId));
      return {
        title: "Add gov contract contact",
        summary: `Add ${args.name} (${args.role}) to ${label ? `"${label}"` : String(args.govContractId)}.`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        createGovContractContact({
          govContractId: args.govContractId as string,
          name: args.name as string,
          title: args.title as string | undefined,
          email: args.email as string | undefined,
          phone: args.phone as string | undefined,
          organization: args.organization as string | undefined,
          role: args.role as ContactRole,
          notes: args.notes as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "updateGovContractContact",
    label: "Update Gov Contract Contact",
    risk: "additive",
    description: "Update a government contract contact.",
    parameters: {
      properties: {
        contactId: { type: "string", description: "The contact ID" },
        name: { type: "string", description: "New name" },
        title: { type: "string", description: "New job title" },
        email: { type: "string", description: "New email" },
        phone: { type: "string", description: "New phone" },
        organization: { type: "string", description: "New organization" },
        role: { type: "string", enum: [...CONTACT_ROLE_ENUM], description: "New role" },
        notes: { type: "string", description: "New notes" },
      },
      required: ["contactId"],
    },
    preview: async (args) => ({
      title: "Update gov contract contact",
      summary: `Contact ${args.contactId} — ${changeSummary(args, ["contactId"])}`,
    }),
    execute: async (args) =>
      unwrapAction(
        updateGovContractContact(args.contactId as string, {
          name: args.name as string | undefined,
          title: args.title as string | undefined,
          email: args.email as string | undefined,
          phone: args.phone as string | undefined,
          organization: args.organization as string | undefined,
          role: args.role as ContactRole | undefined,
          notes: args.notes as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "deleteGovContractContact",
    label: "Delete Gov Contract Contact",
    risk: "destructive",
    description: "Permanently delete a government contract contact.",
    parameters: {
      properties: { contactId: { type: "string", description: "The contact ID" } },
      required: ["contactId"],
    },
    preview: async (args) => ({
      title: "Delete gov contract contact",
      summary: `Contact ${args.contactId} will be permanently deleted. This cannot be undone.`,
    }),
    execute: async (args) =>
      unwrapAction(deleteGovContractContact(args.contactId as string)),
  }),

  defineTool({
    name: "importOpportunityToContract",
    label: "Import Opportunity",
    risk: "additive",
    description: "Import a SAM.gov opportunity into the contract pipeline.",
    parameters: {
      properties: { opportunityId: { type: "string", description: "The opportunity ID" } },
      required: ["opportunityId"],
    },
    preview: async (args) => ({
      title: "Import opportunity",
      summary: `Opportunity ${args.opportunityId} will be imported into the contract pipeline.`,
    }),
    execute: async (args) =>
      unwrapAction(importOpportunityToContract(args.opportunityId as string)),
  }),

  defineTool({
    name: "dismissOpportunity",
    label: "Dismiss Opportunity",
    risk: "additive",
    description: "Hide a SAM.gov opportunity from the active list.",
    parameters: {
      properties: { opportunityId: { type: "string", description: "The opportunity ID" } },
      required: ["opportunityId"],
    },
    preview: async (args) => ({
      title: "Dismiss opportunity",
      summary: `Opportunity ${args.opportunityId} will be hidden from the active list.`,
    }),
    execute: async (args) => unwrapAction(dismissOpportunity(args.opportunityId as string)),
  }),

  defineTool({
    name: "undismissOpportunity",
    label: "Restore Opportunity",
    risk: "additive",
    description: "Restore a previously dismissed SAM.gov opportunity.",
    parameters: {
      properties: { opportunityId: { type: "string", description: "The opportunity ID" } },
      required: ["opportunityId"],
    },
    preview: async (args) => ({
      title: "Restore opportunity",
      summary: `Opportunity ${args.opportunityId} will be restored to the active list.`,
    }),
    execute: async (args) => unwrapAction(undismissOpportunity(args.opportunityId as string)),
  }),

  defineTool({
    name: "reanalyzeOpportunity",
    label: "Reanalyze Opportunity",
    risk: "additive",
    description: "Re-run the AI fit analysis for a SAM.gov opportunity, replacing the previous scores.",
    parameters: {
      properties: { opportunityId: { type: "string", description: "The opportunity ID" } },
      required: ["opportunityId"],
    },
    preview: async (args) => ({
      title: "Reanalyze opportunity",
      summary: `The existing AI analysis for opportunity ${args.opportunityId} will be replaced.`,
    }),
    execute: async (args) => unwrapAction(reanalyzeOpportunity(args.opportunityId as string)),
  }),

  defineTool({
    name: "syncSamOpportunities",
    label: "Sync SAM.gov Opportunities",
    risk: "destructive",
    description:
      "Pull opportunities from the SAM.gov API. A full sync is a long-running bulk write over the opportunity table.",
    parameters: {
      properties: {
        fullSync: { type: "boolean", description: "Run a full sync instead of incremental" },
      },
    },
    preview: async (args) => ({
      title: "Sync SAM.gov opportunities",
      summary: args.fullSync
        ? "A full SAM.gov sync will run and bulk-write the opportunity table."
        : "An incremental SAM.gov sync will run and write new opportunities.",
    }),
    execute: async (args) => unwrapAction(syncSamOpportunities(Boolean(args.fullSync))),
  }),

  defineTool({
    name: "syncUsaSpending",
    label: "Sync USASpending",
    risk: "destructive",
    description:
      "Pull award data from the USASpending API. A full sync is a long-running bulk write.",
    parameters: {
      properties: {
        fullSync: { type: "boolean", description: "Run a full sync instead of current fiscal year" },
      },
    },
    preview: async (args) => ({
      title: "Sync USASpending",
      summary: args.fullSync
        ? "A full USASpending sync will run and bulk-write spending records."
        : "A current fiscal year USASpending sync will run.",
    }),
    execute: async (args) => unwrapAction(syncUsaSpending(Boolean(args.fullSync))),
  }),
];
