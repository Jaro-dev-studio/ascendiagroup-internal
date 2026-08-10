import prisma from "@/lib/prisma";
import {
  createCrmNote,
  createDeal,
  createPerson,
  deleteCrmNote,
  deleteDeal,
  deletePerson,
  researchCompanyNow,
  updateCompanyCrmFields,
  updateDeal,
  updateDealStage,
  updatePerson,
} from "@/lib/actions/crm";
import { pricingItemSummary } from "@/lib/crm/deal-pricing";
import { defineTool, type AITool } from "../types";
import { lookupEntityLabel } from "../preview";
import { changeSummary, definedOnly, deletePreview, unwrapAction } from "./helpers";
import type { CrmLifecycleStage } from "@prisma/client";

const LIFECYCLE_ENUM = [
  "LEAD",
  "QUALIFIED",
  "OPPORTUNITY",
  "CUSTOMER",
  "CHURNED",
  "DISQUALIFIED",
] as const;

const CURRENCY_ENUM = ["USD", "EUR", "GBP"] as const;

const PRICING_TYPE_ENUM = ["PROJECT", "HOURLY", "RETAINER"] as const;

const BILLING_INTERVAL_ENUM = ["MONTHLY", "QUARTERLY", "ANNUAL"] as const;

/** Shared JSON schema for the pricing structure on create and update. */
const PRICING_ITEMS_PARAMETER = {
  type: "array",
  description:
    "The deal's pricing structure. A deal can mix any number of project, hourly and retainer items. The deal value is the sum of every item, so never set value alongside this.",
  items: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: [...PRICING_TYPE_ENUM],
        description: "PROJECT for a fixed fee, HOURLY for rate x hours, RETAINER for a recurring fee",
      },
      label: { type: "string", description: "What this line covers, for example \"MVP build\"" },
      unitAmount: {
        type: "number",
        description:
          "PROJECT: the fixed fee. HOURLY: the rate per hour. RETAINER: the amount per interval.",
      },
      quantity: {
        type: "number",
        description:
          "PROJECT: omit. HOURLY: estimated hours. RETAINER: number of billing periods, defaults to 3.",
      },
      interval: {
        type: "string",
        enum: [...BILLING_INTERVAL_ENUM],
        description: "Billing interval for RETAINER items, defaults to MONTHLY",
      },
    },
    required: ["type", "unitAmount"],
  },
} as const;

interface PricingItemArg {
  type: (typeof PRICING_TYPE_ENUM)[number];
  label?: string;
  unitAmount: number;
  quantity?: number;
  interval?: (typeof BILLING_INTERVAL_ENUM)[number];
}

function pricingItemsArg(value: unknown): PricingItemArg[] | undefined {
  return Array.isArray(value) ? (value as PricingItemArg[]) : undefined;
}

/** One line per pricing item, for the confirmation card. */
function pricingSummary(items: PricingItemArg[], currency: string): string {
  return items
    .map((item) =>
      pricingItemSummary(
        {
          type: item.type,
          unitAmount: item.unitAmount,
          quantity: item.type === "PROJECT" ? 1 : (item.quantity ?? 1),
          interval: item.type === "RETAINER" ? (item.interval ?? "MONTHLY") : null,
        },
        currency
      )
    )
    .join("; ");
}

async function companyName(companyId: unknown): Promise<string | null> {
  if (typeof companyId !== "string" || !companyId) return null;
  return lookupEntityLabel("company", companyId);
}

async function stageName(stageId: unknown): Promise<string | null> {
  if (typeof stageId !== "string" || !stageId) return null;
  return lookupEntityLabel("pipelineStage", stageId);
}

/** Describes which record a note is attached to, for the confirmation card. */
async function noteTargetSummary(args: Record<string, unknown>): Promise<string> {
  const targets: string[] = [];

  const person = await lookupEntityLabel("person", String(args.personId ?? ""));
  if (person) targets.push(`contact ${person}`);

  const company = await companyName(args.companyId);
  if (company) targets.push(`account ${company}`);

  const deal = await lookupEntityLabel("deal", String(args.dealId ?? ""));
  if (deal) targets.push(`deal ${deal}`);

  return targets.length > 0 ? targets.join(", ") : "no linked record";
}

export const crmWriteTools: AITool[] = [
  defineTool({
    name: "createPerson",
    label: "Create Contact",
    risk: "additive",
    description:
      "Create a CRM contact. The email address is the unique key: if a contact with that email already exists it is updated instead of duplicated. Resolve companyId with queryCompanies and ownerId with queryUsers first.",
    parameters: {
      properties: {
        email: { type: "string", description: "Email address, used as the unique key" },
        firstName: { type: "string", description: "First name" },
        lastName: { type: "string", description: "Last name" },
        jobTitle: { type: "string", description: "Job title" },
        phone: { type: "string", description: "Phone number" },
        linkedinUrl: { type: "string", description: "LinkedIn profile URL" },
        companyId: { type: "string", description: "Company ID this contact belongs to" },
        ownerId: { type: "string", description: "Owning user ID" },
        lifecycleStage: {
          type: "string",
          enum: [...LIFECYCLE_ENUM],
          description: "Lifecycle stage, defaults to LEAD",
        },
      },
      required: ["email"],
    },
    preview: async (args) => {
      const company = await companyName(args.companyId);
      const name = [args.firstName, args.lastName].filter(Boolean).join(" ");

      return {
        title: "Create contact",
        summary: `${name || (args.email as string)}${company ? ` at ${company}` : ""}. An existing contact with this email would be updated instead.`,
        details: {
          Email: args.email as string,
          "Job title": (args.jobTitle as string) ?? "—",
          "Lifecycle stage": (args.lifecycleStage as string) ?? "LEAD",
          Company: company ?? "—",
        },
      };
    },
    execute: async (args) =>
      unwrapAction(
        createPerson({
          email: args.email as string,
          firstName: args.firstName as string | undefined,
          lastName: args.lastName as string | undefined,
          jobTitle: args.jobTitle as string | undefined,
          phone: args.phone as string | undefined,
          linkedinUrl: args.linkedinUrl as string | undefined,
          companyId: args.companyId as string | undefined,
          ownerId: args.ownerId as string | undefined,
          lifecycleStage: args.lifecycleStage as CrmLifecycleStage | undefined,
        })
      ),
  }),

  defineTool({
    name: "updatePerson",
    label: "Update Contact",
    risk: "additive",
    description:
      "Update a CRM contact. Only the fields you provide are changed. Setting doNotContact to true also adds the contact's email to the global suppression list. Resolve the contact ID with queryPeople first.",
    parameters: {
      properties: {
        personId: { type: "string", description: "The contact ID" },
        firstName: { type: "string", description: "New first name" },
        lastName: { type: "string", description: "New last name" },
        jobTitle: { type: "string", description: "New job title" },
        phone: { type: "string", description: "New phone number" },
        linkedinUrl: { type: "string", description: "New LinkedIn URL" },
        companyId: { type: "string", description: "New company ID, or null to unlink" },
        ownerId: { type: "string", description: "New owning user ID, or null to unassign" },
        lifecycleStage: {
          type: "string",
          enum: [...LIFECYCLE_ENUM],
          description: "New lifecycle stage",
        },
        doNotContact: {
          type: "boolean",
          description: "True suppresses this contact from all outbound email",
        },
      },
      required: ["personId"],
    },
    preview: async (args) => {
      const { personId, ...changes } = args;
      const [name, company] = await Promise.all([
        lookupEntityLabel("person", String(personId)),
        companyName(changes.companyId),
      ]);

      return {
        title: "Update contact",
        summary: `${name ?? personId}: ${changeSummary(changes)}${
          changes.doNotContact === true
            ? ". This also adds their email to the global suppression list."
            : ""
        }`,
        details: { ...changes, ...(company ? { companyId: company } : {}) },
      };
    },
    execute: async (args) => {
      const { personId, ...changes } = args;

      return unwrapAction(
        updatePerson(personId as string, definedOnly(changes) as Parameters<typeof updatePerson>[1])
      );
    },
  }),

  defineTool({
    name: "deletePerson",
    label: "Delete Contact",
    risk: "destructive",
    description:
      "Permanently delete a CRM contact along with their notes, activities and sequence enrollments. Prefer setting doNotContact with updatePerson when the goal is only to stop contacting them.",
    parameters: {
      properties: {
        personId: { type: "string", description: "The contact ID" },
      },
      required: ["personId"],
    },
    preview: deletePreview("person", "personId", "contact"),
    execute: async (args) => unwrapAction(deletePerson(args.personId as string)),
  }),

  defineTool({
    name: "updateCompanyCrmFields",
    label: "Update Account",
    risk: "additive",
    description:
      "Update the CRM fields of a company: name, domain, website, industry, employee count, LinkedIn, description and owner. Company status cannot be set here because it is derived from the company's deals; move a deal with moveDealStage to change it.",
    parameters: {
      properties: {
        companyId: { type: "string", description: "The company ID" },
        name: { type: "string", description: "New company name" },
        domain: { type: "string", description: "Primary email domain" },
        website: { type: "string", description: "Website URL" },
        industry: { type: "string", description: "Industry" },
        employeeCount: { type: "number", description: "Employee count" },
        linkedinUrl: { type: "string", description: "LinkedIn company URL" },
        description: { type: "string", description: "Company description" },
        ownerId: { type: "string", description: "New owning user ID, or null to unassign" },
      },
      required: ["companyId"],
    },
    preview: async (args) => {
      const { companyId, ...changes } = args;
      const name = await companyName(companyId);

      return {
        title: "Update account",
        summary: `${name ?? companyId}: ${changeSummary(changes)}`,
        details: changes,
      };
    },
    execute: async (args) => {
      const { companyId, ...changes } = args;

      return unwrapAction(
        updateCompanyCrmFields(
          companyId as string,
          definedOnly(changes) as Parameters<typeof updateCompanyCrmFields>[1]
        )
      );
    },
  }),

  defineTool({
    name: "researchCompany",
    label: "Research Account",
    risk: "additive",
    description:
      "Research a company from scratch: reads their website, researches them on the open web, then writes a description, their brand colours, and a shortlist of work Jaro could sell them onto the company record. This runs automatically when a qualified lead submits the form, so only call it when the brief is missing, stale, or the user asks for a fresh one. It takes about a minute. Resolve companyId with queryCompanies first.",
    parameters: {
      properties: {
        companyId: { type: "string", description: "The company ID to research" },
      },
      required: ["companyId"],
    },
    preview: async (args) => {
      const name = await companyName(args.companyId);

      return {
        title: "Research account",
        summary: `Research ${name ?? args.companyId} from their website and the web, and overwrite their research brief. Takes about a minute.`,
      };
    },
    execute: async (args) => {
      const result = await unwrapAction(researchCompanyNow(args.companyId as string));

      return {
        ...(result as Record<string, unknown>),
        note: "The brief is on the company record. Read it back with queryCompanies if you need to quote it.",
      };
    },
  }),

  defineTool({
    name: "createDeal",
    label: "Create Deal",
    risk: "additive",
    description:
      "Create a deal in the default pipeline. Resolve stageId with queryPipelines, companyId with queryCompanies and primaryPersonId with queryPeople first. Omitting stageId places the deal in the first stage. Prefer pricingItems over value so the deal carries its pricing structure. Creating a deal also updates the company's derived status.",
    parameters: {
      properties: {
        name: { type: "string", description: "Deal name" },
        value: {
          type: "number",
          description:
            "Total contract value, defaults to 0. Only use this when you have no pricing breakdown; pricingItems overrides it.",
        },
        currency: {
          type: "string",
          enum: [...CURRENCY_ENUM],
          description: "Currency, defaults to USD",
        },
        pricingItems: PRICING_ITEMS_PARAMETER,
        stageId: { type: "string", description: "Pipeline stage ID (see queryPipelines)" },
        companyId: { type: "string", description: "Company ID" },
        primaryPersonId: { type: "string", description: "Primary contact ID" },
        ownerId: { type: "string", description: "Owning user ID, defaults to you" },
        closeDate: { type: "string", description: "Expected close date as an ISO 8601 date string" },
      },
      required: ["name"],
    },
    preview: async (args) => {
      const [company, stage, person] = await Promise.all([
        companyName(args.companyId),
        stageName(args.stageId),
        lookupEntityLabel("person", String(args.primaryPersonId ?? "")),
      ]);

      const currency = (args.currency as string) ?? "USD";
      const pricingItems = pricingItemsArg(args.pricingItems);

      return {
        title: "Create deal",
        summary: `"${args.name}"${company ? ` for ${company}` : ""}${
          args.value ? ` worth ${currency} ${Number(args.value).toLocaleString()}` : ""
        }`,
        details: {
          Stage: stage ?? "first stage of the default pipeline",
          Company: company ?? "—",
          "Primary contact": person ?? "—",
          "Close date": (args.closeDate as string) ?? "—",
          Pricing: pricingItems?.length
            ? pricingSummary(pricingItems, currency)
            : "—",
        },
      };
    },
    execute: async (args) =>
      unwrapAction(
        createDeal({
          name: args.name as string,
          value: args.value as number | undefined,
          currency: args.currency as string | undefined,
          pricingItems: pricingItemsArg(args.pricingItems),
          stageId: args.stageId as string | undefined,
          companyId: args.companyId as string | undefined,
          primaryPersonId: args.primaryPersonId as string | undefined,
          ownerId: args.ownerId as string | undefined,
          closeDate: args.closeDate as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "updateDeal",
    label: "Update Deal",
    risk: "additive",
    description:
      "Update a deal's name, pricing structure, currency, linked company or contact, owner, close date or lost reason. Use moveDealStage to change the stage. Only the fields you provide are changed, and supplying pricingItems replaces the whole pricing structure.",
    parameters: {
      properties: {
        dealId: { type: "string", description: "The deal ID" },
        name: { type: "string", description: "New deal name" },
        value: {
          type: "number",
          description:
            "New total contract value. Only use this when you have no pricing breakdown; pricingItems overrides it.",
        },
        currency: { type: "string", enum: [...CURRENCY_ENUM], description: "New currency" },
        pricingItems: PRICING_ITEMS_PARAMETER,
        companyId: { type: "string", description: "New company ID, or null to unlink" },
        primaryPersonId: { type: "string", description: "New primary contact ID, or null to unlink" },
        ownerId: { type: "string", description: "New owning user ID, or null to unassign" },
        closeDate: { type: "string", description: "New close date as an ISO 8601 date string, or null to clear" },
        lostReason: { type: "string", description: "Reason the deal was lost" },
      },
      required: ["dealId"],
    },
    preview: async (args) => {
      const { dealId, pricingItems, ...changes } = args;
      const name = await lookupEntityLabel("deal", String(dealId));
      const items = pricingItemsArg(pricingItems);

      const summarised = items?.length
        ? {
          ...changes,
          pricing: pricingSummary(items, (args.currency as string) ?? "USD"),
        }
        : changes;

      return {
        title: "Update deal",
        summary: `${name ?? dealId}: ${changeSummary(summarised)}`,
        details: summarised,
      };
    },
    execute: async (args) => {
      const { dealId, ...changes } = args;

      return unwrapAction(
        updateDeal(dealId as string, definedOnly(changes) as Parameters<typeof updateDeal>[1])
      );
    },
  }),

  defineTool({
    name: "moveDealStage",
    label: "Move Deal Stage",
    risk: "additive",
    description:
      "Move a deal to a different pipeline stage. This logs a stage change on the timeline, sets won/lost timestamps when the stage is a win or loss, and updates the company's derived status. Resolve the stage ID with queryPipelines first.",
    parameters: {
      properties: {
        dealId: { type: "string", description: "The deal ID" },
        stageId: { type: "string", description: "The target pipeline stage ID" },
      },
      required: ["dealId", "stageId"],
    },
    preview: async (args) => {
      const [deal, stage] = await Promise.all([
        lookupEntityLabel("deal", String(args.dealId)),
        stageName(args.stageId),
      ]);

      return {
        title: "Move deal stage",
        summary: `Move ${deal ?? args.dealId} to ${stage ?? args.stageId}. The account status updates to match.`,
        details: { Deal: deal ?? args.dealId, "New stage": stage ?? args.stageId },
      };
    },
    execute: async (args) =>
      unwrapAction(updateDealStage(args.dealId as string, args.stageId as string)),
  }),

  defineTool({
    name: "deleteDeal",
    label: "Delete Deal",
    risk: "destructive",
    description:
      "Permanently delete a deal and its notes and activities. The linked company's derived status is recalculated afterwards.",
    parameters: {
      properties: {
        dealId: { type: "string", description: "The deal ID" },
      },
      required: ["dealId"],
    },
    preview: deletePreview("deal", "dealId", "deal"),
    execute: async (args) => unwrapAction(deleteDeal(args.dealId as string)),
  }),

  defineTool({
    name: "createCrmNote",
    label: "Create CRM Note",
    risk: "additive",
    description:
      "Add a note to a CRM contact, account or deal. The note also appears on that record's activity timeline. Provide at least one of personId, companyId or dealId.",
    parameters: {
      properties: {
        content: { type: "string", description: "Note body" },
        title: { type: "string", description: "Optional note title" },
        personId: { type: "string", description: "Contact ID to attach the note to" },
        companyId: { type: "string", description: "Company ID to attach the note to" },
        dealId: { type: "string", description: "Deal ID to attach the note to" },
      },
      required: ["content"],
    },
    preview: async (args) => {
      const target = await noteTargetSummary(args);
      const content = String(args.content ?? "");

      return {
        title: "Add CRM note",
        summary: `Note on ${target}`,
        details: {
          Title: (args.title as string) ?? "—",
          Content: content.length > 300 ? `${content.slice(0, 297)}...` : content,
        },
      };
    },
    execute: async (args) => {
      if (!args.personId && !args.companyId && !args.dealId) {
        throw new Error("Provide at least one of personId, companyId or dealId");
      }

      return unwrapAction(
        createCrmNote({
          content: args.content as string,
          title: args.title as string | undefined,
          personId: args.personId as string | undefined,
          companyId: args.companyId as string | undefined,
          dealId: args.dealId as string | undefined,
        })
      );
    },
  }),

  defineTool({
    name: "deleteCrmNote",
    label: "Delete CRM Note",
    risk: "destructive",
    description:
      "Permanently delete a CRM note. Find the note ID with getCrmRecord or queryCrmTimeline.",
    parameters: {
      properties: {
        noteId: { type: "string", description: "The note ID" },
      },
      required: ["noteId"],
    },
    preview: async (args) => {
      const noteId = String(args.noteId ?? "");
      const note = noteId
        ? await prisma.crmNote.findUnique({
          where: { id: noteId },
          select: { title: true, content: true },
        })
        : null;

      const label = note?.title || note?.content.slice(0, 80) || noteId;

      return {
        title: "Delete CRM note",
        summary: `"${label}" will be permanently deleted. This cannot be undone.`,
        details: { id: noteId },
      };
    },
    execute: async (args) => unwrapAction(deleteCrmNote(args.noteId as string)),
  }),
];
