import type { Company, EmbedFormSubmission, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getEmailDomain, isGenericEmailDomain } from "@/lib/crm/people";
import { logCrmActivity } from "@/lib/crm/activity";
import { researchCompany, type CompanyResearch } from "./company-research";

/**
 * Runs the research agent for a company and writes the result back. Everything
 * that decides whether research should run, and what it is allowed to
 * overwrite, lives here so the form pipeline and the manual re-run behave
 * identically.
 */

/** Re-researching a company we already looked at recently buys nothing. */
const FRESHNESS_DAYS = 30;

export interface RunResearchResult {
  status: "completed" | "skipped" | "failed";
  reason?: string;
  research?: CompanyResearch;
}

/** Their site is the best source; the email domain is the fallback. */
function resolveDomain(company: Company, submission: EmbedFormSubmission | null): string | null {
  const candidates = [
    company.domain,
    company.website,
    submission ? getEmailDomain(submission.email) : null,
  ];

  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;

    const domain = candidate
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");

    if (domain && !isGenericEmailDomain(domain)) return domain;
  }

  return null;
}

function isFresh(company: Company): boolean {
  if (company.researchStatus !== "COMPLETED" || !company.researchedAt) return false;

  const ageMs = Date.now() - company.researchedAt.getTime();
  return ageMs < FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * The description is the research summary until somebody writes their own, at
 * which point research stops touching it.
 */
function shouldMirrorIntoDescription(company: Company): boolean {
  const description = company.description?.trim();
  if (!description) return true;
  return description === company.researchSummary?.trim();
}

function buildUpdate(company: Company, research: CompanyResearch, domain: string): Prisma.CompanyUpdateInput {
  const update: Prisma.CompanyUpdateInput = {
    researchSummary: research.summary,
    researchOpportunities: research.opportunities as unknown as Prisma.InputJsonValue,
    researchDiscoveryQuestions: research.discoveryQuestions,
    researchSources: research.sources as unknown as Prisma.InputJsonValue,
    researchConfidence: research.confidence,
    researchStatus: "COMPLETED",
    researchError: null,
    researchedAt: new Date(),
  };

  if (shouldMirrorIntoDescription(company)) {
    update.description = research.summary;
  }

  // Only fill gaps: anything already on the record was either set by a human or
  // by a system with a better source than this.
  if (!company.domain) update.domain = domain;
  if (!company.domains.includes(domain)) update.domains = { push: domain };
  if (!company.industry && research.industry) update.industry = research.industry;
  if (!company.employeeCount && research.employeeCountEstimate) {
    update.employeeCount = research.employeeCountEstimate;
  }
  if (!company.linkedinUrl && research.linkedinUrl) update.linkedinUrl = research.linkedinUrl;

  if (research.brand) {
    if (!company.logoUrl && research.brand.logoUrl) update.logoUrl = research.brand.logoUrl;
    if (!company.primaryColor) update.primaryColor = research.brand.primaryColor;
    if (!company.secondaryColor) update.secondaryColor = research.brand.secondaryColor;
    if (!company.accentColor) update.accentColor = research.brand.accentColor;
  }

  return update;
}

export async function runCompanyResearch(options: {
  companyId: string;
  submissionId?: string | null;
  /** Ignores the freshness window; used by the manual re-run. */
  force?: boolean;
}): Promise<{ data: RunResearchResult | null; error: string | null }> {
  const { companyId, submissionId = null, force = false } = options;

  try {
    console.log(`[CompanyResearch] starting run for company ${companyId} (force=${force})`);

    const company = await prisma.company.findUnique({ where: { id: companyId } });

    if (!company) {
      return { data: null, error: `Company ${companyId} not found` };
    }

    if (!force && isFresh(company)) {
      const reason = `already researched ${company.researchedAt?.toISOString().split("T")[0]}`;
      console.log(`[CompanyResearch] skipping ${company.name}: ${reason}`);
      return { data: { status: "skipped", reason }, error: null };
    }

    // The triggering submission is the best form context; failing that, the most
    // recent one on the company still tells us what they want.
    const submission = submissionId
      ? await prisma.embedFormSubmission.findUnique({ where: { id: submissionId } })
      : await prisma.embedFormSubmission.findFirst({
        where: { companyId },
        orderBy: { createdAt: "desc" },
      });

    const domain = resolveDomain(company, submission);

    if (!domain) {
      const reason = "no usable company domain on record";
      console.log(`[CompanyResearch] skipping ${company.name}: ${reason}`);
      return { data: { status: "skipped", reason }, error: null };
    }

    await prisma.company.update({
      where: { id: companyId },
      data: { researchStatus: "PENDING", researchError: null },
    });

    const result = await researchCompany({
      domain,
      companyName: company.name,
      submission,
    });

    if (!result.data) {
      const message = result.error ?? "Company research returned nothing";
      console.log(`[CompanyResearch] failed for ${company.name}: ${message}`);

      await prisma.company.update({
        where: { id: companyId },
        data: {
          researchStatus: "FAILED",
          researchError: message.slice(0, 500),
          researchedAt: new Date(),
        },
      });

      return { data: { status: "failed", reason: message }, error: null };
    }

    await prisma.company.update({
      where: { id: companyId },
      data: buildUpdate(company, result.data, domain),
    });

    console.log(`[CompanyResearch] saved research for ${company.name}`);

    await logCrmActivity({
      type: "NOTE",
      title: "Researched the company automatically",
      body: result.data.summary,
      companyId,
      payload: {
        opportunities: result.data.opportunities,
        confidence: result.data.confidence,
        sources: result.data.sources,
        submissionId: submission?.id ?? null,
      } as unknown as Prisma.InputJsonValue,
      // Keyed on the submission so a retried pipeline call does not log twice;
      // a manual re-run is its own event.
      externalId: submission
        ? `company-research:${submission.id}`
        : `company-research:${companyId}:${Date.now()}`,
    });

    return { data: { status: "completed", research: result.data }, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[CompanyResearch] run failed:", error);

    await prisma.company
      .update({
        where: { id: companyId },
        data: { researchStatus: "FAILED", researchError: message.slice(0, 500) },
      })
      .catch(() => undefined);

    return { data: null, error: `Company research run failed: ${message}` };
  }
}
