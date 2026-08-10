"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth-helpers";
import { logCrmActivity } from "@/lib/crm/activity";
import { ensureDefaultPipeline, moveDealToStage } from "@/lib/crm/pipeline";
import { syncCompanyStatus, syncCompanyStatuses } from "@/lib/crm/company-status";
import { upsertPersonByEmail } from "@/lib/crm/people";
import { dealContractValue } from "@/lib/crm/deal-pricing";
import { runCompanyResearch } from "@/lib/research/run";
import type {
  CompanyResearchStatus,
  CrmLifecycleStage,
  DealBillingInterval,
  DealPricingType,
} from "@prisma/client";

interface ActionResult<T> {
  data: T | null;
  error: string | null;
}

const LOG = "[CRM]";

// ============================================================================
// People
// ============================================================================

export interface CreatePersonInput {
  email: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  phone?: string;
  linkedinUrl?: string;
  companyId?: string | null;
  ownerId?: string | null;
  lifecycleStage?: CrmLifecycleStage;
}

export async function createPerson(
  input: CreatePersonInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    console.log(`${LOG} Creating contact ${input.email}...`);

    const result = await upsertPersonByEmail({
      email: input.email,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      jobTitle: input.jobTitle ?? null,
      phone: input.phone ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      companyId: input.companyId ?? null,
      ownerId: input.ownerId ?? null,
      source: "manual",
    });

    if (!result.data) {
      return { data: null, error: result.error ?? "Failed to create contact" };
    }

    if (input.lifecycleStage) {
      await prisma.person.update({
        where: { id: result.data.id },
        data: { lifecycleStage: input.lifecycleStage },
      });
    }

    console.log(`${LOG} Contact created: ${result.data.id}`);
    revalidatePath("/dashboard/crm/people");
    return { data: { id: result.data.id }, error: null };
  } catch (error) {
    console.error(`${LOG} Failed to create contact:`, error);
    return { data: null, error: "Failed to create contact" };
  }
}

export interface UpdatePersonInput {
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  companyId?: string | null;
  ownerId?: string | null;
  lifecycleStage?: CrmLifecycleStage;
  doNotContact?: boolean;
}

export async function updatePerson(
  id: string,
  input: UpdatePersonInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const existing = await prisma.person.findUnique({
      where: { id },
      select: { lifecycleStage: true, doNotContact: true, email: true },
    });

    if (!existing) return { data: null, error: "Contact not found" };

    const fullName =
      input.firstName !== undefined || input.lastName !== undefined
        ? [input.firstName, input.lastName].filter(Boolean).join(" ") || null
        : undefined;

    await prisma.person.update({
      where: { id },
      data: { ...input, fullName },
    });

    if (
      input.lifecycleStage &&
      input.lifecycleStage !== existing.lifecycleStage
    ) {
      await logCrmActivity({
        type: "FIELD_CHANGED",
        title: `Lifecycle stage changed to ${input.lifecycleStage}`,
        personId: id,
        actorUserId: user.id,
        payload: {
          field: "lifecycleStage",
          from: existing.lifecycleStage,
          to: input.lifecycleStage,
        },
      });
    }

    // Opting a contact out is a suppression event, so mirror it globally
    if (input.doNotContact && !existing.doNotContact && existing.email) {
      await prisma.suppression.upsert({
        where: { email: existing.email },
        update: {},
        create: {
          email: existing.email,
          reason: "manual",
          note: `Marked do-not-contact by ${user.email}`,
        },
      });
    }

    revalidatePath("/dashboard/crm/people");
    revalidatePath(`/dashboard/crm/people/${id}`);
    return { data: { id }, error: null };
  } catch (error) {
    console.error(`${LOG} Failed to update contact:`, error);
    return { data: null, error: "Failed to update contact" };
  }
}

export async function deletePerson(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    await prisma.person.delete({ where: { id } });

    revalidatePath("/dashboard/crm/people");
    return { data: { id }, error: null };
  } catch (error) {
    console.error(`${LOG} Failed to delete contact:`, error);
    return { data: null, error: "Failed to delete contact" };
  }
}

// ============================================================================
// Companies
// ============================================================================

export interface UpdateCompanyCrmInput {
  name?: string;
  domain?: string | null;
  website?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
  linkedinUrl?: string | null;
  description?: string | null;
  ownerId?: string | null;
}

export async function updateCompanyCrmFields(
  id: string,
  input: UpdateCompanyCrmInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    await prisma.company.update({ where: { id }, data: input });

    revalidatePath("/dashboard/crm/companies");
    revalidatePath(`/dashboard/crm/companies/${id}`);
    return { data: { id }, error: null };
  } catch (error) {
    console.error(`${LOG} Failed to update company:`, error);
    return { data: null, error: "Failed to update company" };
  }
}

/**
 * Kicks off research and returns straight away. The run itself takes about a
 * minute, and an in-flight server action blocks router navigations, so the work
 * happens after the response instead of inside it.
 */
export async function startCompanyResearch(
  id: string
): Promise<ActionResult<{ status: "started" }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!company) return { data: null, error: "Company not found" };

    console.log(`${LOG} queueing company research for ${id}...`);

    // Marked pending before responding so the brief still reads as running if
    // the user navigates away and comes back mid-run.
    await prisma.company.update({
      where: { id },
      data: { researchStatus: "PENDING", researchError: null },
    });

    revalidatePath(`/dashboard/crm/companies/${id}`);

    after(async () => {
      const result = await runCompanyResearch({ companyId: id, force: true });

      // A skipped run writes no status of its own, so the pending flag above
      // would stick and the UI would poll forever.
      if (result.data?.status === "skipped") {
        await prisma.company.update({
          where: { id },
          data: {
            researchStatus: "FAILED",
            researchError: (result.data.reason ?? "There was nothing to research").slice(0, 500),
          },
        });
      }
    });

    return { data: { status: "started" }, error: null };
  } catch (error) {
    console.error(`${LOG} Failed to start company research:`, error);
    return { data: null, error: "Failed to start company research" };
  }
}

/** Lets the client watch a backgrounded run without refetching the whole page. */
export async function getCompanyResearchStatus(
  id: string
): Promise<ActionResult<{ status: CompanyResearchStatus; error: string | null }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const company = await prisma.company.findUnique({
      where: { id },
      select: { researchStatus: true, researchError: true },
    });
    if (!company) return { data: null, error: "Company not found" };

    return {
      data: { status: company.researchStatus, error: company.researchError },
      error: null,
    };
  } catch (error) {
    console.error(`${LOG} Failed to read research status:`, error);
    return { data: null, error: "Failed to read research status" };
  }
}

/**
 * Re-runs the research agent for a company and waits for the brief. Used by the
 * AI agent, which reports the outcome in the same turn; the dashboard uses
 * startCompanyResearch instead so the UI stays usable.
 */
export async function researchCompanyNow(
  id: string
): Promise<ActionResult<{ status: string; reason?: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    console.log(`${LOG} Re-running company research for ${id}...`);
    const result = await runCompanyResearch({ companyId: id, force: true });

    if (result.error) return { data: null, error: result.error };

    revalidatePath("/dashboard/crm/companies");
    revalidatePath(`/dashboard/crm/companies/${id}`);

    return {
      data: { status: result.data?.status ?? "skipped", reason: result.data?.reason },
      error: null,
    };
  } catch (error) {
    console.error(`${LOG} Failed to research company:`, error);
    return { data: null, error: "Failed to research company" };
  }
}

// ============================================================================
// Deals
// ============================================================================

export interface DealPricingItemInput {
  type: DealPricingType;
  label?: string | null;
  /** PROJECT: fixed fee. HOURLY: rate per hour. RETAINER: amount per interval. */
  unitAmount: number;
  /** PROJECT: 1. HOURLY: estimated hours. RETAINER: number of billing periods. */
  quantity?: number;
  /** Required for RETAINER, ignored otherwise. */
  interval?: DealBillingInterval | null;
  notes?: string | null;
}

export interface CreateDealInput {
  name: string;
  /** Ignored when pricingItems are supplied, since the total is derived. */
  value?: number;
  currency?: string;
  stageId?: string;
  companyId?: string | null;
  primaryPersonId?: string | null;
  ownerId?: string | null;
  closeDate?: string | null;
  pricingItems?: DealPricingItemInput[];
}

/** Normalises form/AI input into rows, dropping quantities the type ignores. */
function toPricingItemRows(items: DealPricingItemInput[]) {
  return items.map((item, index) => ({
    type: item.type,
    label: item.label?.trim() || null,
    unitAmount: Math.max(0, Math.round(item.unitAmount)),
    quantity:
      item.type === "PROJECT" ? 1 : Math.max(1, Math.round(item.quantity ?? 1)),
    interval: item.type === "RETAINER" ? (item.interval ?? "MONTHLY") : null,
    notes: item.notes?.trim() || null,
    order: index,
  }));
}

export async function createDeal(
  input: CreateDealInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const pipeline = await ensureDefaultPipeline();
    const stageId = input.stageId ?? pipeline.stages[0].id;

    console.log(`${LOG} Creating deal "${input.name}"...`);

    const pricingRows = input.pricingItems
      ? toPricingItemRows(input.pricingItems)
      : [];

    // Pricing items are the source of truth for value whenever they exist.
    const value =
      pricingRows.length > 0
        ? dealContractValue(pricingRows)
        : (input.value ?? 0);

    if (pricingRows.length > 0) {
      console.log(
        `${LOG} Derived contract value ${value} from ${pricingRows.length} pricing item(s)...`
      );
    }

    const deal = await prisma.deal.create({
      data: {
        name: input.name,
        value,
        currency: input.currency ?? "USD",
        pipelineId: pipeline.id,
        stageId,
        companyId: input.companyId ?? null,
        primaryPersonId: input.primaryPersonId ?? null,
        ownerId: input.ownerId ?? user.id,
        closeDate: input.closeDate ? new Date(input.closeDate) : null,
        pricingItems:
          pricingRows.length > 0 ? { create: pricingRows } : undefined,
      },
      select: { id: true },
    });

    await logCrmActivity({
      type: "FIELD_CHANGED",
      title: `Deal "${input.name}" created`,
      dealId: deal.id,
      companyId: input.companyId ?? null,
      personId: input.primaryPersonId ?? null,
      actorUserId: user.id,
    });

    await syncCompanyStatus(input.companyId);

    console.log(`${LOG} Deal created: ${deal.id}`);
    revalidatePath("/dashboard/crm/deals");
    return { data: { id: deal.id }, error: null };
  } catch (error) {
    console.error(`${LOG} Failed to create deal:`, error);
    return { data: null, error: "Failed to create deal" };
  }
}

export async function updateDealStage(
  dealId: string,
  stageId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const [deal, stage] = await Promise.all([
      prisma.deal.findUnique({
        where: { id: dealId },
        select: { stage: { select: { name: true } } },
      }),
      prisma.pipelineStage.findUnique({
        where: { id: stageId },
        select: { name: true },
      }),
    ]);

    if (!deal || !stage) return { data: null, error: "Deal or stage not found" };

    console.log(
      `${LOG} Moving deal ${dealId} from "${deal.stage.name}" to "${stage.name}"...`
    );

    await moveDealToStage(dealId, stageId, user.id);

    revalidatePath("/dashboard/crm/deals");
    revalidatePath(`/dashboard/crm/deals/${dealId}`);
    revalidatePath("/dashboard/crm/companies");
    return { data: { id: dealId }, error: null };
  } catch (error) {
    console.error(`${LOG} Failed to move deal:`, error);
    return { data: null, error: "Failed to move deal" };
  }
}

export interface UpdateDealInput {
  name?: string;
  /** Ignored when pricingItems are supplied, since the total is derived. */
  value?: number;
  currency?: string;
  companyId?: string | null;
  primaryPersonId?: string | null;
  ownerId?: string | null;
  closeDate?: string | null;
  lostReason?: string | null;
  /** Replaces the whole pricing structure when provided. */
  pricingItems?: DealPricingItemInput[];
}

export async function updateDeal(
  id: string,
  input: UpdateDealInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const previous = await prisma.deal.findUnique({
      where: { id },
      select: { companyId: true },
    });

    const { pricingItems, value: inputValue, ...fields } = input;
    const pricingRows = pricingItems ? toPricingItemRows(pricingItems) : null;

    // A supplied pricing structure always wins over a passed-in value.
    const value = pricingRows
      ? dealContractValue(pricingRows)
      : inputValue;

    const data = {
      ...fields,
      value,
      closeDate:
        input.closeDate === undefined
          ? undefined
          : input.closeDate
            ? new Date(input.closeDate)
            : null,
    };

    if (pricingRows) {
      console.log(
        `${LOG} Replacing pricing structure on deal ${id} with ${pricingRows.length} item(s), contract value ${value}...`
      );

      await prisma.$transaction([
        prisma.dealPricingItem.deleteMany({ where: { dealId: id } }),
        ...(pricingRows.length > 0
          ? [
            prisma.dealPricingItem.createMany({
              data: pricingRows.map((row) => ({ ...row, dealId: id })),
            }),
          ]
          : []),
        prisma.deal.update({ where: { id }, data }),
      ]);
    } else {
      await prisma.deal.update({ where: { id }, data });
    }

    // Reassigning a deal changes the derived status of both companies.
    await syncCompanyStatuses([previous?.companyId, input.companyId]);

    revalidatePath("/dashboard/crm/deals");
    revalidatePath(`/dashboard/crm/deals/${id}`);
    revalidatePath("/dashboard/crm/companies");
    return { data: { id }, error: null };
  } catch (error) {
    console.error(`${LOG} Failed to update deal:`, error);
    return { data: null, error: "Failed to update deal" };
  }
}

export async function deleteDeal(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const deal = await prisma.deal.delete({
      where: { id },
      select: { companyId: true },
    });

    await syncCompanyStatus(deal.companyId);

    revalidatePath("/dashboard/crm/deals");
    revalidatePath("/dashboard/crm/companies");
    return { data: { id }, error: null };
  } catch (error) {
    console.error(`${LOG} Failed to delete deal:`, error);
    return { data: null, error: "Failed to delete deal" };
  }
}

// ============================================================================
// Notes
// ============================================================================

export interface CreateNoteInput {
  content: string;
  title?: string | null;
  personId?: string | null;
  companyId?: string | null;
  dealId?: string | null;
}

export async function createCrmNote(
  input: CreateNoteInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    if (!input.content.trim()) {
      return { data: null, error: "Note content is required" };
    }

    const note = await prisma.crmNote.create({
      data: {
        title: input.title ?? null,
        content: input.content.trim(),
        format: "plaintext",
        personId: input.personId ?? null,
        companyId: input.companyId ?? null,
        dealId: input.dealId ?? null,
        authorId: user.id,
        authorEmail: user.email,
      },
      select: { id: true },
    });

    await logCrmActivity({
      type: "NOTE",
      title: input.title || "Note added",
      body: input.content.trim(),
      personId: input.personId ?? null,
      companyId: input.companyId ?? null,
      dealId: input.dealId ?? null,
      actorUserId: user.id,
    });

    if (input.personId) revalidatePath(`/dashboard/crm/people/${input.personId}`);
    if (input.companyId)
      revalidatePath(`/dashboard/crm/companies/${input.companyId}`);
    if (input.dealId) revalidatePath(`/dashboard/crm/deals/${input.dealId}`);

    return { data: { id: note.id }, error: null };
  } catch (error) {
    console.error(`${LOG} Failed to create note:`, error);
    return { data: null, error: "Failed to create note" };
  }
}

export async function deleteCrmNote(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const note = await prisma.crmNote.delete({
      where: { id },
      select: { id: true, personId: true, companyId: true, dealId: true },
    });

    if (note.personId) revalidatePath(`/dashboard/crm/people/${note.personId}`);
    if (note.companyId)
      revalidatePath(`/dashboard/crm/companies/${note.companyId}`);
    if (note.dealId) revalidatePath(`/dashboard/crm/deals/${note.dealId}`);

    return { data: { id }, error: null };
  } catch (error) {
    console.error(`${LOG} Failed to delete note:`, error);
    return { data: null, error: "Failed to delete note" };
  }
}
