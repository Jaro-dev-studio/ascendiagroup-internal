import prisma from "@/lib/prisma";
import {
  getCompanyDetail,
  getCrmTimeline,
  getDealDetail,
  getPersonDetail,
} from "@/lib/fetchers/crm";
import {
  dealMonthlyRecurring,
  pricingItemAmount,
} from "@/lib/crm/deal-pricing";
import { getEntityHref } from "../entity-href";
import { defineTool, type AITool } from "../types";
import type { DealPricingType } from "@prisma/client";

const PRICING_TYPE_ENUM = ["PROJECT", "HOURLY", "RETAINER"] as const;

const LIFECYCLE_ENUM = [
  "LEAD",
  "QUALIFIED",
  "OPPORTUNITY",
  "CUSTOMER",
  "CHURNED",
  "DISQUALIFIED",
] as const;

const COMPANY_STATUS_ENUM = [
  "FORM_SUBMITTED",
  "CALL_BOOKED",
  "NO_SHOW",
  "ATTENDED_SALES_CALL",
  "PURCHASED",
  "LOST",
  "CHURNED",
] as const;

const CONNECTION_STRENGTH_ENUM = ["STRONG", "MEDIUM", "WEAK"] as const;

const ACTIVITY_TYPE_ENUM = [
  "NOTE",
  "EMAIL_SENT",
  "EMAIL_RECEIVED",
  "EMAIL_REPLIED",
  "EMAIL_BOUNCED",
  "MEETING_SCHEDULED",
  "MEETING_ACCEPTED",
  "MEETING_DECLINED",
  "MEETING",
  "STAGE_CHANGE",
  "FORM_SUBMITTED",
  "SEQUENCE_ENROLLED",
  "SEQUENCE_STEP_SENT",
  "SEQUENCE_STOPPED",
  "FIELD_CHANGED",
  "TASK_CREATED",
  "IMPORTED",
] as const;

const ENGAGEMENT_SELECT = {
  lastEmailInteractionAt: true,
  lastCalendarInteractionAt: true,
  nextCalendarEventAt: true,
  nextCalendarEventTitle: true,
  connectionStrength: true,
} as const;

const OWNER_SELECT = {
  select: { id: true, firstName: true, lastName: true, email: true },
} as const;

function ownerName(owner: {
  firstName: string | null;
  lastName: string | null;
  email: string;
} | null): string | null {
  if (!owner) return null;
  return `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() || owner.email;
}

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

/** Adds the dashboard link to a nested company or contact reference. */
function withHref<T extends { id: string }>(
  record: T | null,
  kind: "person" | "company"
): (T & { href: string }) | null {
  return record ? { ...record, href: getEntityHref(kind, record.id) } : null;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Serialises engagement columns, which are computed by lib/crm/engagement.ts. */
function engagement(record: {
  lastEmailInteractionAt: Date | null;
  lastCalendarInteractionAt: Date | null;
  nextCalendarEventAt: Date | null;
  nextCalendarEventTitle: string | null;
  connectionStrength: string | null;
}) {
  return {
    connectionStrength: record.connectionStrength,
    lastEmailInteractionAt: iso(record.lastEmailInteractionAt),
    lastCalendarInteractionAt: iso(record.lastCalendarInteractionAt),
    nextCalendarEventAt: iso(record.nextCalendarEventAt),
    nextCalendarEventTitle: record.nextCalendarEventTitle,
  };
}

export const crmReadTools: AITool[] = [
  defineTool({
    name: "queryPeople",
    label: "Query Contacts",
    risk: "read",
    description:
      "Query CRM contacts (people) with optional filters. Returns contact details, their company, owner, lifecycle stage and engagement signals. Use this to resolve a person's name or email to a person ID before any contact, deal or sequence operation.",
    parameters: {
      properties: {
        searchQuery: {
          type: "string",
          description: "Search across name, email and job title",
        },
        companyId: { type: "string", description: "Only contacts at this company ID" },
        lifecycleStage: {
          type: "array",
          items: { type: "string", enum: [...LIFECYCLE_ENUM] },
          description: "Filter by lifecycle stage",
        },
        ownerId: { type: "string", description: "Filter by owning user ID" },
        connectionStrength: {
          type: "array",
          items: { type: "string", enum: [...CONNECTION_STRENGTH_ENUM] },
          description: "Filter by computed engagement strength",
        },
        doNotContact: { type: "boolean", description: "Filter by the do-not-contact flag" },
        hasActiveSequence: {
          type: "boolean",
          description: "True for contacts currently enrolled in a sequence, false for those not enrolled",
        },
        noEmailSince: {
          type: "string",
          description:
            "ISO date. Only contacts whose last email interaction is older than this, or who have never interacted",
        },
        limit: { type: "number", description: "Maximum contacts to return (default 25, max 100)" },
      },
    },
    execute: async (args) => {
      const {
        searchQuery,
        companyId,
        lifecycleStage,
        ownerId,
        connectionStrength,
        doNotContact,
        hasActiveSequence,
        noEmailSince,
        limit = 25,
      } = args as {
        searchQuery?: string;
        companyId?: string;
        lifecycleStage?: string[];
        ownerId?: string;
        connectionStrength?: string[];
        doNotContact?: boolean;
        hasActiveSequence?: boolean;
        noEmailSince?: string;
        limit?: number;
      };

      const where: Record<string, unknown> = {};

      if (searchQuery) {
        where.OR = [
          { fullName: { contains: searchQuery, mode: "insensitive" } },
          { email: { contains: searchQuery, mode: "insensitive" } },
          { jobTitle: { contains: searchQuery, mode: "insensitive" } },
        ];
      }
      if (companyId) where.companyId = companyId;
      if (lifecycleStage?.length) where.lifecycleStage = { in: lifecycleStage };
      if (ownerId) where.ownerId = ownerId;
      if (connectionStrength?.length) where.connectionStrength = { in: connectionStrength };
      if (doNotContact !== undefined) where.doNotContact = doNotContact;

      // Kept in AND so it composes with the searchQuery OR rather than replacing it.
      const since = parseDate(noEmailSince);
      if (since) {
        where.AND = [
          { OR: [{ lastEmailInteractionAt: null }, { lastEmailInteractionAt: { lt: since } }] },
        ];
      }

      if (hasActiveSequence !== undefined) {
        where.sequenceEnrollments = hasActiveSequence
          ? { some: { status: "ACTIVE" } }
          : { none: { status: "ACTIVE" } };
      }

      const people = await prisma.person.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 100),
        select: {
          id: true,
          email: true,
          fullName: true,
          jobTitle: true,
          phone: true,
          linkedinUrl: true,
          lifecycleStage: true,
          doNotContact: true,
          createdAt: true,
          ...ENGAGEMENT_SELECT,
          company: { select: { id: true, name: true } },
          owner: OWNER_SELECT,
          _count: { select: { sequenceEnrollments: { where: { status: "ACTIVE" } } } },
        },
      });

      return {
        count: people.length,
        people: people.map((person) => ({
          id: person.id,
          href: getEntityHref("person", person.id),
          name: person.fullName,
          email: person.email,
          jobTitle: person.jobTitle,
          phone: person.phone,
          linkedinUrl: person.linkedinUrl,
          lifecycleStage: person.lifecycleStage,
          doNotContact: person.doNotContact,
          company: withHref(person.company, "company"),
          owner: ownerName(person.owner),
          activeSequences: person._count.sequenceEnrollments,
          createdAt: person.createdAt.toISOString(),
          ...engagement(person),
        })),
      };
    },
  }),

  defineTool({
    name: "queryCompanies",
    label: "Query Accounts",
    risk: "read",
    description:
      "Query CRM accounts (companies) with firmographics, engagement signals and contact/deal/meeting counts. This is the CRM view of the same company record that queryClients returns for delivery work: use queryCompanies for pipeline and relationship questions, queryClients for Slack channels and delivery statistics. Company status is derived from the company's deals and cannot be set directly.",
    parameters: {
      properties: {
        searchQuery: { type: "string", description: "Search across name, domain and website" },
        status: {
          type: "array",
          items: { type: "string", enum: [...COMPANY_STATUS_ENUM] },
          description: "Filter by derived company status",
        },
        industry: { type: "string", description: "Filter by industry (partial match)" },
        ownerId: { type: "string", description: "Filter by owning user ID" },
        connectionStrength: {
          type: "array",
          items: { type: "string", enum: [...CONNECTION_STRENGTH_ENUM] },
          description: "Filter by computed engagement strength",
        },
        hasOpenDeals: { type: "boolean", description: "Only accounts with a deal that is neither won nor lost" },
        limit: { type: "number", description: "Maximum accounts to return (default 25, max 100)" },
      },
    },
    execute: async (args) => {
      const {
        searchQuery,
        status,
        industry,
        ownerId,
        connectionStrength,
        hasOpenDeals,
        limit = 25,
      } = args as {
        searchQuery?: string;
        status?: string[];
        industry?: string;
        ownerId?: string;
        connectionStrength?: string[];
        hasOpenDeals?: boolean;
        limit?: number;
      };

      const where: Record<string, unknown> = {};

      if (searchQuery) {
        where.OR = [
          { name: { contains: searchQuery, mode: "insensitive" } },
          { domain: { contains: searchQuery, mode: "insensitive" } },
          { website: { contains: searchQuery, mode: "insensitive" } },
        ];
      }
      if (status?.length) where.status = { in: status };
      if (industry) where.industry = { contains: industry, mode: "insensitive" };
      if (ownerId) where.ownerId = ownerId;
      if (connectionStrength?.length) where.connectionStrength = { in: connectionStrength };
      if (hasOpenDeals) {
        where.deals = { some: { stage: { isWon: false, isLost: false } } };
      }

      const companies = await prisma.company.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 100),
        select: {
          id: true,
          name: true,
          domain: true,
          website: true,
          industry: true,
          employeeCount: true,
          status: true,
          linkedinUrl: true,
          createdAt: true,
          ...ENGAGEMENT_SELECT,
          owner: OWNER_SELECT,
          _count: { select: { people: true, deals: true, meetings: true } },
        },
      });

      return {
        count: companies.length,
        companies: companies.map((company) => ({
          id: company.id,
          href: getEntityHref("company", company.id),
          name: company.name,
          domain: company.domain,
          website: company.website,
          industry: company.industry,
          employeeCount: company.employeeCount,
          status: company.status,
          linkedinUrl: company.linkedinUrl,
          owner: ownerName(company.owner),
          peopleCount: company._count.people,
          dealCount: company._count.deals,
          meetingCount: company._count.meetings,
          createdAt: company.createdAt.toISOString(),
          ...engagement(company),
        })),
      };
    },
  }),

  defineTool({
    name: "queryDeals",
    label: "Query Deals",
    risk: "read",
    description:
      "Query deals in the sales pipeline with optional filters. Returns the total contract value, the pricing structure (project, hourly and retainer items), stage, company, primary contact, owner and close dates. Use this to resolve a deal name to its ID before updating, moving or deleting it.",
    parameters: {
      properties: {
        searchQuery: { type: "string", description: "Search by deal name" },
        pricingType: {
          type: "array",
          items: { type: "string", enum: [...PRICING_TYPE_ENUM] },
          description: "Only deals with at least one pricing item of these types",
        },
        stageId: { type: "string", description: "Filter by pipeline stage ID (see queryPipelines)" },
        stageName: { type: "string", description: "Filter by stage name (partial match)" },
        companyId: { type: "string", description: "Filter by company ID" },
        personId: { type: "string", description: "Filter by primary contact ID" },
        ownerId: { type: "string", description: "Filter by owning user ID" },
        state: {
          type: "string",
          enum: ["open", "won", "lost"],
          description: "Filter by deal state derived from the stage flags",
        },
        minValue: { type: "number", description: "Minimum deal value" },
        maxValue: { type: "number", description: "Maximum deal value" },
        closeDateAfter: { type: "string", description: "ISO date, only deals closing on or after this" },
        closeDateBefore: { type: "string", description: "ISO date, only deals closing on or before this" },
        limit: { type: "number", description: "Maximum deals to return (default 25, max 100)" },
      },
    },
    execute: async (args) => {
      const {
        searchQuery,
        pricingType,
        stageId,
        stageName,
        companyId,
        personId,
        ownerId,
        state,
        minValue,
        maxValue,
        closeDateAfter,
        closeDateBefore,
        limit = 25,
      } = args as {
        searchQuery?: string;
        pricingType?: DealPricingType[];
        stageId?: string;
        stageName?: string;
        companyId?: string;
        personId?: string;
        ownerId?: string;
        state?: "open" | "won" | "lost";
        minValue?: number;
        maxValue?: number;
        closeDateAfter?: string;
        closeDateBefore?: string;
        limit?: number;
      };

      const where: Record<string, unknown> = {};
      const stageWhere: Record<string, unknown> = {};

      if (searchQuery) where.name = { contains: searchQuery, mode: "insensitive" };
      if (stageId) where.stageId = stageId;
      if (companyId) where.companyId = companyId;
      if (personId) where.primaryPersonId = personId;
      if (ownerId) where.ownerId = ownerId;
      if (pricingType?.length) {
        where.pricingItems = { some: { type: { in: pricingType } } };
      }

      if (stageName) stageWhere.name = { contains: stageName, mode: "insensitive" };
      if (state === "open") {
        stageWhere.isWon = false;
        stageWhere.isLost = false;
      } else if (state === "won") {
        stageWhere.isWon = true;
      } else if (state === "lost") {
        stageWhere.isLost = true;
      }
      if (Object.keys(stageWhere).length > 0) where.stage = stageWhere;

      if (minValue !== undefined || maxValue !== undefined) {
        where.value = {
          ...(minValue !== undefined ? { gte: minValue } : {}),
          ...(maxValue !== undefined ? { lte: maxValue } : {}),
        };
      }

      const after = parseDate(closeDateAfter);
      const before = parseDate(closeDateBefore);
      if (after || before) {
        where.closeDate = {
          ...(after ? { gte: after } : {}),
          ...(before ? { lte: before } : {}),
        };
      }

      const deals = await prisma.deal.findMany({
        where,
        orderBy: [{ stage: { order: "asc" } }, { value: "desc" }],
        take: Math.min(limit, 100),
        select: {
          id: true,
          name: true,
          value: true,
          currency: true,
          closeDate: true,
          wonAt: true,
          lostAt: true,
          lostReason: true,
          createdAt: true,
          pricingItems: {
            orderBy: { order: "asc" },
            select: {
              type: true,
              label: true,
              unitAmount: true,
              quantity: true,
              interval: true,
            },
          },
          stage: { select: { id: true, name: true, probability: true, isWon: true, isLost: true } },
          company: { select: { id: true, name: true } },
          primaryPerson: { select: { id: true, fullName: true, email: true } },
          owner: OWNER_SELECT,
        },
      });

      const totalValue = deals.reduce((sum, deal) => sum + deal.value, 0);

      return {
        count: deals.length,
        totalValue,
        deals: deals.map((deal) => ({
          id: deal.id,
          href: getEntityHref("deal", deal.id),
          name: deal.name,
          value: deal.value,
          currency: deal.currency,
          pricing: deal.pricingItems.map((item) => ({
            ...item,
            amount: pricingItemAmount(item),
          })),
          monthlyRecurring: Math.round(dealMonthlyRecurring(deal.pricingItems)),
          stage: deal.stage,
          company: withHref(deal.company, "company"),
          primaryPerson: withHref(deal.primaryPerson, "person"),
          owner: ownerName(deal.owner),
          closeDate: iso(deal.closeDate),
          wonAt: iso(deal.wonAt),
          lostAt: iso(deal.lostAt),
          lostReason: deal.lostReason,
          createdAt: deal.createdAt.toISOString(),
        })),
      };
    },
  }),

  defineTool({
    name: "getCrmRecord",
    label: "Get CRM Record",
    risk: "read",
    description:
      "Get the full detail of a single CRM record: a contact with their deals, notes and sequence enrollments, a company with its contacts, deals, notes, meetings and its automated research brief (what they do, their brand, and the work we could sell them), or a deal with its pipeline stages and notes. Resolve the ID with queryPeople, queryCompanies or queryDeals first.",
    parameters: {
      properties: {
        objectType: {
          type: "string",
          enum: ["person", "company", "deal"],
          description: "Which kind of record to load",
        },
        id: { type: "string", description: "The record ID" },
      },
      required: ["objectType", "id"],
    },
    execute: async (args) => {
      const { objectType, id } = args as {
        objectType: "person" | "company" | "deal";
        id: string;
      };

      const result =
        objectType === "person"
          ? await getPersonDetail(id)
          : objectType === "company"
            ? await getCompanyDetail(id)
            : await getDealDetail(id);

      if (result.error) throw new Error(result.error);
      if (!result.data) return { found: false, objectType, id };

      return {
        found: true,
        objectType,
        href: getEntityHref(objectType, id),
        record: result.data,
      };
    },
  }),

  defineTool({
    name: "queryCrmTimeline",
    label: "Query CRM Timeline",
    risk: "read",
    description:
      "Get the activity timeline for a contact, company or deal: notes, emails, meetings, stage changes, form submissions and sequence events. Provide at least one of personId, companyId or dealId.",
    parameters: {
      properties: {
        personId: { type: "string", description: "Contact ID" },
        companyId: { type: "string", description: "Company ID" },
        dealId: { type: "string", description: "Deal ID" },
        includeCompanyPeople: {
          type: "boolean",
          description: "With companyId, also include activities belonging to the company's contacts",
        },
        types: {
          type: "array",
          items: { type: "string", enum: [...ACTIVITY_TYPE_ENUM] },
          description: "Only return these activity types",
        },
        limit: { type: "number", description: "Maximum entries to return (default 50, max 200)" },
      },
    },
    execute: async (args) => {
      const { personId, companyId, dealId, includeCompanyPeople, types, limit = 50 } = args as {
        personId?: string;
        companyId?: string;
        dealId?: string;
        includeCompanyPeople?: boolean;
        types?: string[];
        limit?: number;
      };

      if (!personId && !companyId && !dealId) {
        throw new Error("Provide at least one of personId, companyId or dealId");
      }

      const result = await getCrmTimeline({
        personId,
        companyId,
        dealId,
        includeCompanyPeople,
        limit: Math.min(limit, 200),
      });

      if (result.error) throw new Error(result.error);

      const entries = (result.data ?? []).filter(
        (entry) => !types?.length || types.includes(entry.type)
      );

      return {
        count: entries.length,
        entries: entries.map((entry) => ({
          id: entry.id,
          type: entry.type,
          title: entry.title,
          body: entry.body,
          occurredAt: entry.occurredAt.toISOString(),
          meetingId: entry.meetingId,
          meetingHref: entry.meetingId
            ? getEntityHref("meeting", entry.meetingId)
            : null,
          actor: ownerName(entry.actorUser),
          person: withHref(entry.person, "person"),
        })),
      };
    },
  }),

  defineTool({
    name: "queryPipelines",
    label: "Query Pipelines",
    risk: "read",
    description:
      "List sales pipelines with their stages, including each stage's win/loss flags and the company status it maps to. Always call this to resolve a stage name to a stage ID before creating a deal or moving one to a different stage.",
    parameters: {
      properties: {
        includeDealCounts: {
          type: "boolean",
          description: "Include the number of deals sitting in each stage",
        },
      },
    },
    execute: async (args) => {
      const { includeDealCounts } = args as { includeDealCounts?: boolean };

      const pipelines = await prisma.pipeline.findMany({
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          isDefault: true,
          stages: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              name: true,
              order: true,
              probability: true,
              isWon: true,
              isLost: true,
              companyStatus: true,
              ...(includeDealCounts ? { _count: { select: { deals: true } } } : {}),
            },
          },
        },
      });

      return {
        count: pipelines.length,
        pipelines: pipelines.map((pipeline) => ({
          id: pipeline.id,
          name: pipeline.name,
          slug: pipeline.slug,
          isDefault: pipeline.isDefault,
          stages: pipeline.stages.map((stage) => {
            const { _count, ...rest } = stage as typeof stage & {
              _count?: { deals: number };
            };
            return {
              ...rest,
              ...(includeDealCounts ? { dealCount: _count?.deals ?? 0 } : {}),
            };
          }),
        })),
      };
    },
  }),
];
