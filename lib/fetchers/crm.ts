import prisma from "@/lib/prisma";
import { ensureDefaultPipeline } from "@/lib/crm/pipeline";
import type {
  CompanyResearchStatus,
  CompanyStatus,
  CrmActivityType,
  CrmConnectionStrength,
  CrmLifecycleStage,
  DealBillingInterval,
  DealPricingType,
  EnrollmentStatus,
} from "@prisma/client";
import type { ResearchOpportunity, ResearchSource } from "@/types/research";

interface FetchResult<T> {
  data: T | null;
  error: string | null;
}

const OWNER_SELECT = {
  select: { id: true, firstName: true, lastName: true, email: true },
} as const;

/** Json columns come back untyped, and a legacy row may hold anything. */
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export interface CrmOwner {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

/**
 * Denormalised engagement columns shared by people and companies, maintained by
 * lib/crm/engagement.ts. Null means we have no recorded interaction.
 */
export interface EngagementFields {
  lastEmailInteractionAt: Date | null;
  lastCalendarInteractionAt: Date | null;
  nextCalendarEventAt: Date | null;
  nextCalendarEventTitle: string | null;
  connectionStrength: CrmConnectionStrength | null;
}

const ENGAGEMENT_SELECT = {
  lastEmailInteractionAt: true,
  lastCalendarInteractionAt: true,
  nextCalendarEventAt: true,
  nextCalendarEventTitle: true,
  connectionStrength: true,
} as const;

export interface PersonListItem extends EngagementFields {
  id: string;
  email: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  lifecycleStage: CrmLifecycleStage;
  doNotContact: boolean;
  createdAt: Date;
  company: { id: string; name: string } | null;
  owner: CrmOwner | null;
  activeSequences: number;
}

export async function getCrmPeople(): Promise<FetchResult<PersonListItem[]>> {
  try {
    const people = await prisma.person.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        fullName: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        phone: true,
        linkedinUrl: true,
        lifecycleStage: true,
        doNotContact: true,
        createdAt: true,
        ...ENGAGEMENT_SELECT,
        company: { select: { id: true, name: true } },
        owner: OWNER_SELECT,
        _count: {
          select: {
            sequenceEnrollments: { where: { status: "ACTIVE" } },
          },
        },
      },
    });

    return {
      data: people.map(({ _count, ...person }) => ({
        ...person,
        activeSequences: _count.sequenceEnrollments,
      })),
      error: null,
    };
  } catch (error) {
    console.error("[CRM] Failed to fetch people:", error);
    return { data: null, error: "Failed to load people" };
  }
}

export interface CompanyListItem extends EngagementFields {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  employeeCount: number | null;
  status: CompanyStatus;
  linkedinUrl: string | null;
  createdAt: Date;
  owner: CrmOwner | null;
  peopleCount: number;
  dealCount: number;
  meetingCount: number;
}

export async function getCrmCompanies(): Promise<
  FetchResult<CompanyListItem[]>
  > {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: "desc" },
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
        _count: {
          select: { people: true, deals: true, meetings: true },
        },
      },
    });

    return {
      data: companies.map(({ _count, ...company }) => ({
        ...company,
        peopleCount: _count.people,
        dealCount: _count.deals,
        meetingCount: _count.meetings,
      })),
      error: null,
    };
  } catch (error) {
    console.error("[CRM] Failed to fetch companies:", error);
    return { data: null, error: "Failed to load companies" };
  }
}

export interface DealPricingItemView {
  id: string;
  type: DealPricingType;
  label: string | null;
  unitAmount: number;
  quantity: number;
  interval: DealBillingInterval | null;
  notes: string | null;
}

const PRICING_ITEMS_SELECT = {
  select: {
    id: true,
    type: true,
    label: true,
    unitAmount: true,
    quantity: true,
    interval: true,
    notes: true,
  },
  orderBy: { order: "asc" },
} as const;

export interface DealListItem {
  id: string;
  name: string;
  value: number;
  currency: string;
  pricingItems: DealPricingItemView[];
  closeDate: Date | null;
  wonAt: Date | null;
  lostAt: Date | null;
  createdAt: Date;
  stage: {
    id: string;
    name: string;
    order: number;
    probability: number;
    isWon: boolean;
    isLost: boolean;
  };
  company: { id: string; name: string } | null;
  primaryPerson: { id: string; fullName: string | null; email: string | null } | null;
  owner: CrmOwner | null;
}

export interface DealsBoardData {
  deals: DealListItem[];
  stages: Array<{
    id: string;
    name: string;
    order: number;
    isWon: boolean;
    isLost: boolean;
  }>;
}

export async function getCrmDeals(): Promise<FetchResult<DealsBoardData>> {
  try {
    const pipeline = await ensureDefaultPipeline();

    const deals = await prisma.deal.findMany({
      orderBy: [{ stage: { order: "asc" } }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        value: true,
        currency: true,
        closeDate: true,
        wonAt: true,
        lostAt: true,
        createdAt: true,
        pricingItems: PRICING_ITEMS_SELECT,
        stage: {
          select: {
            id: true,
            name: true,
            order: true,
            probability: true,
            isWon: true,
            isLost: true,
          },
        },
        company: { select: { id: true, name: true } },
        primaryPerson: {
          select: { id: true, fullName: true, email: true },
        },
        owner: OWNER_SELECT,
      },
    });

    return {
      data: {
        deals,
        stages: pipeline.stages.map((stage) => ({
          id: stage.id,
          name: stage.name,
          order: stage.order,
          isWon: stage.isWon,
          isLost: stage.isLost,
        })),
      },
      error: null,
    };
  } catch (error) {
    console.error("[CRM] Failed to fetch deals:", error);
    return { data: null, error: "Failed to load deals" };
  }
}

export interface TimelineEntry {
  id: string;
  type: CrmActivityType;
  title: string;
  body: string | null;
  payload: unknown;
  occurredAt: Date;
  meetingId: string | null;
  actorUser: CrmOwner | null;
  person: { id: string; fullName: string | null; email: string | null } | null;
}

interface TimelineScope {
  personId?: string;
  companyId?: string;
  dealId?: string;
  /** Also include activities belonging to the company's contacts */
  includeCompanyPeople?: boolean;
  limit?: number;
}

/**
 * A long-standing client accumulates hundreds of calls and emails, so the cap
 * is high enough that a record's history reads as complete rather than cut off
 * partway through.
 */
const TIMELINE_LIMIT = 500;

export async function getCrmTimeline(
  scope: TimelineScope
): Promise<FetchResult<TimelineEntry[]>> {
  try {
    const conditions: Array<Record<string, string>> = [];
    if (scope.personId) conditions.push({ personId: scope.personId });
    if (scope.companyId) conditions.push({ companyId: scope.companyId });
    if (scope.dealId) conditions.push({ dealId: scope.dealId });

    if (conditions.length === 0) {
      return { data: [], error: null };
    }

    const activities = await prisma.crmActivity.findMany({
      where: { OR: conditions },
      orderBy: { occurredAt: "desc" },
      take: scope.limit ?? TIMELINE_LIMIT,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        payload: true,
        occurredAt: true,
        meetingId: true,
        actorUser: OWNER_SELECT,
        person: { select: { id: true, fullName: true, email: true } },
      },
    });

    return { data: activities, error: null };
  } catch (error) {
    console.error("[CRM] Failed to fetch timeline:", error);
    return { data: null, error: "Failed to load timeline" };
  }
}

export interface PersonDetail {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  jobTitle: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  avatarUrl: string | null;
  description: string | null;
  lifecycleStage: CrmLifecycleStage;
  source: string | null;
  doNotContact: boolean;
  customFields: unknown;
  createdAt: Date;
  company: { id: string; name: string; domain: string | null } | null;
  owner: CrmOwner | null;
  deals: Array<{
    id: string;
    name: string;
    value: number;
    currency: string;
    pricingItems: DealPricingItemView[];
    stage: { name: string; isWon: boolean; isLost: boolean };
  }>;
  crmNotes: Array<{
    id: string;
    title: string | null;
    content: string;
    format: string;
    authorEmail: string | null;
    createdAt: Date;
  }>;
  enrollments: Array<{
    id: string;
    status: EnrollmentStatus;
    currentStep: number;
    nextSendAt: Date | null;
    sequence: { id: string; name: string };
  }>;
}

export async function getPersonDetail(
  id: string
): Promise<FetchResult<PersonDetail | null>> {
  try {
    const person = await prisma.person.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        fullName: true,
        jobTitle: true,
        phone: true,
        linkedinUrl: true,
        avatarUrl: true,
        description: true,
        lifecycleStage: true,
        source: true,
        doNotContact: true,
        customFields: true,
        createdAt: true,
        company: { select: { id: true, name: true, domain: true } },
        owner: OWNER_SELECT,
        deals: {
          select: {
            id: true,
            name: true,
            value: true,
            currency: true,
            pricingItems: PRICING_ITEMS_SELECT,
            stage: { select: { name: true, isWon: true, isLost: true } },
          },
        },
        crmNotes: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            content: true,
            format: true,
            authorEmail: true,
            createdAt: true,
          },
        },
        sequenceEnrollments: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            currentStep: true,
            nextSendAt: true,
            sequence: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!person) return { data: null, error: null };

    const { sequenceEnrollments, ...rest } = person;
    return { data: { ...rest, enrollments: sequenceEnrollments }, error: null };
  } catch (error) {
    console.error("[CRM] Failed to fetch person:", error);
    return { data: null, error: "Failed to load contact" };
  }
}

export interface CompanyDetail {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  employeeCount: number | null;
  linkedinUrl: string | null;
  description: string | null;
  status: CompanyStatus;
  customFields: unknown;
  createdAt: Date;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  researchSummary: string | null;
  researchOpportunities: ResearchOpportunity[];
  researchDiscoveryQuestions: string[];
  researchSources: ResearchSource[];
  researchConfidence: string | null;
  researchStatus: CompanyResearchStatus;
  researchError: string | null;
  researchedAt: Date | null;
  owner: CrmOwner | null;
  people: Array<{
    id: string;
    fullName: string | null;
    email: string | null;
    jobTitle: string | null;
    lifecycleStage: CrmLifecycleStage;
  }>;
  deals: Array<{
    id: string;
    name: string;
    value: number;
    currency: string;
    pricingItems: DealPricingItemView[];
    stage: { name: string; isWon: boolean; isLost: boolean };
  }>;
  crmNotes: Array<{
    id: string;
    title: string | null;
    content: string;
    format: string;
    authorEmail: string | null;
    createdAt: Date;
  }>;
  meetings: Array<{
    id: string;
    title: string;
    startTime: Date;
    callType: string | null;
  }>;
}

export async function getCompanyDetail(
  id: string
): Promise<FetchResult<CompanyDetail | null>> {
  try {
    const company = await prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        domain: true,
        website: true,
        industry: true,
        employeeCount: true,
        linkedinUrl: true,
        description: true,
        status: true,
        customFields: true,
        createdAt: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        researchSummary: true,
        researchOpportunities: true,
        researchDiscoveryQuestions: true,
        researchSources: true,
        researchConfidence: true,
        researchStatus: true,
        researchError: true,
        researchedAt: true,
        owner: OWNER_SELECT,
        people: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            fullName: true,
            email: true,
            jobTitle: true,
            lifecycleStage: true,
          },
        },
        deals: {
          select: {
            id: true,
            name: true,
            value: true,
            currency: true,
            pricingItems: PRICING_ITEMS_SELECT,
            stage: { select: { name: true, isWon: true, isLost: true } },
          },
        },
        crmNotes: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            content: true,
            format: true,
            authorEmail: true,
            createdAt: true,
          },
        },
        meetings: {
          orderBy: { startTime: "desc" },
          take: 25,
          select: {
            id: true,
            title: true,
            startTime: true,
            callType: true,
          },
        },
      },
    });

    if (!company) return { data: null, error: null };

    return {
      data: {
        ...company,
        researchOpportunities: asArray<ResearchOpportunity>(company.researchOpportunities),
        researchSources: asArray<ResearchSource>(company.researchSources),
      },
      error: null,
    };
  } catch (error) {
    console.error("[CRM] Failed to fetch company:", error);
    return { data: null, error: "Failed to load company" };
  }
}

export interface DealDetail {
  id: string;
  name: string;
  value: number;
  currency: string;
  pricingItems: DealPricingItemView[];
  closeDate: Date | null;
  wonAt: Date | null;
  lostAt: Date | null;
  lostReason: string | null;
  createdAt: Date;
  stage: { id: string; name: string; isWon: boolean; isLost: boolean };
  pipeline: {
    id: string;
    name: string;
    stages: Array<{ id: string; name: string; order: number }>;
  };
  company: { id: string; name: string } | null;
  primaryPerson: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
  owner: CrmOwner | null;
  crmNotes: Array<{
    id: string;
    title: string | null;
    content: string;
    format: string;
    authorEmail: string | null;
    createdAt: Date;
  }>;
}

export async function getDealDetail(
  id: string
): Promise<FetchResult<DealDetail | null>> {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id },
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
        pricingItems: PRICING_ITEMS_SELECT,
        stage: { select: { id: true, name: true, isWon: true, isLost: true } },
        pipeline: {
          select: {
            id: true,
            name: true,
            stages: {
              orderBy: { order: "asc" },
              select: { id: true, name: true, order: true },
            },
          },
        },
        company: { select: { id: true, name: true } },
        primaryPerson: {
          select: { id: true, fullName: true, email: true },
        },
        owner: OWNER_SELECT,
        crmNotes: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            content: true,
            format: true,
            authorEmail: true,
            createdAt: true,
          },
        },
      },
    });

    return { data: deal, error: null };
  } catch (error) {
    console.error("[CRM] Failed to fetch deal:", error);
    return { data: null, error: "Failed to load deal" };
  }
}

/** Users who can own CRM records, for owner pickers. */
export async function getCrmOwners(): Promise<FetchResult<CrmOwner[]>> {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "DEVELOPER"] } },
      orderBy: { email: "asc" },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    return { data: users, error: null };
  } catch (error) {
    console.error("[CRM] Failed to fetch owners:", error);
    return { data: null, error: "Failed to load owners" };
  }
}
