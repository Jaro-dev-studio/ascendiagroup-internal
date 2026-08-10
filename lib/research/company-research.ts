import OpenAI from "openai";
import type { EmbedFormSubmission } from "@prisma/client";
import { scrapeCompanySite, type ScrapedPage } from "@/lib/scraping/page";
import type { BrandInfo } from "@/lib/scraping/brand";
import { searchWeb, type WebSource } from "@/lib/web-search/search";
import { SERVICE_LINES, SERVICE_LINE_VALUES, serviceLabel } from "@/constants/services";
import { RESEARCH_EVIDENCE_VALUES } from "@/constants/research";
import type { ResearchConfidence, ResearchOpportunity } from "@/types/research";
import {
  BUDGET_LABELS,
  HEADCOUNT_LABELS,
  PLATFORM_LABELS,
  PRODUCT_TYPE_LABELS,
  REVENUE_LABELS,
} from "@/constants/form-submissions";

/**
 * Researches an inbound company from its own website plus the open web, and
 * turns what it finds into a description a salesperson can read and a shortlist
 * of work we could actually sell them.
 *
 * Everything it produces is grounded: the site scrape and the web search both
 * run before the model writes anything, and each opportunity has to name the
 * observation it came from.
 */

const MODEL = "gpt-5-mini";

/**
 * The whole pass sits inside the form processing route, which has 300s. The
 * scrape and the search run concurrently, so the worst case is the search
 * budget plus the synthesis budget, retries included: 150 + 2 x 60 = 270s.
 */
const SYNTHESIS_TIMEOUT_MS = 60_000;
const SYNTHESIS_MAX_RETRIES = 1;

/**
 * Thorough search reads a lot of pages and 40s is not enough for it to finish.
 * Retries are off: if 150s was not enough, another 150s will not be either, and
 * the pass degrades gracefully without the web anyway.
 */
const SEARCH_TIMEOUT_MS = 150_000;

/** Enough of each page to describe the business without flooding the context. */
const MAX_CHARS_PER_PAGE = 6000;

const PAGES_TO_READ = 3;

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export interface CompanyResearch {
  summary: string;
  industry: string | null;
  employeeCountEstimate: number | null;
  linkedinUrl: string | null;
  techStack: string[];
  opportunities: ResearchOpportunity[];
  discoveryQuestions: string[];
  confidence: ResearchConfidence;
  sources: WebSource[];
  brand: BrandInfo | null;
  /** Pages the scrape actually managed to read, for the audit trail. */
  pagesRead: string[];
}

const SYNTHESIS_INSTRUCTIONS = `You research inbound leads for Jaro.dev, an agency that designs, builds and runs custom software for other companies, and brief the salesperson who is about to speak to them.

You are given what the lead told us on our enquiry form, the text of their own website, and a web research summary. Work only from that material.

Produce two things.

1. A description of the company. Say what they sell, who they sell it to, how they make money, and roughly how big they are. Write it for a salesperson who has thirty seconds before the call — plain, specific, no marketing language, and no repetition of their own taglines. Four to six sentences.

2. Up to five pieces of work Jaro could sell them, and at least two when the research supports that many. Each one must:
   - Start from something concrete in the material you were given: a manual process they described on our form, a product they sell, a market they are moving into, a job they are hiring for, a missing mobile app, a data-heavy workflow, a scaling problem they have talked about publicly. Put that in "observation" and make it specific to them.
   - Name where that observation came from in "evidence": "their-form-answers" for anything the lead told us on the form, "their-website" for their own site copy, "web-research" for the web summary. Pick the one you actually took it from.
   - Map to exactly one of our service lines, named in "service".
   - Say what we would build in "proposal", concretely enough that they would recognise their own business in it.
   - Say what it is worth to them in "impact". Do not invent numbers or percentages; describe the outcome instead.

Weight the lead's own form answers heavily. If they told us which services they want, lead with those and put the others after. If they described a manual process, that is your strongest signal and should become an opportunity.

How to read their website, because getting this wrong produces briefs that embarrass us on the call. Their site is marketing copy, and it is full of things that look like facts but are not:
- Marketing pages embed interface mock-ups and product demos: fake issues, fake tickets, fake customers, fake dashboards, fake transactions, invented names and invented data, all rendered as page text. A software company demonstrating its product will show sample records that read exactly like real internal work.
- None of that is evidence about the company. If the page text looks like the contents of an application — a ticket, a bug, a record, a chat thread, a code sample, an API example — it is a demonstration of what they sell, not a problem they have. Never turn one into an opportunity.
- What is fair evidence from their site: what they say they sell, who they say they sell it to, their pricing and plans, their positioning, their published engineering writing, and the roles they are hiring for.
- An "observation" may only state something that actually appears in the material in front of you. Do not write that their site says something, or that something has been reported about them, unless it is really there.

Rules that matter more than being comprehensive:
- Never invent facts. Two opportunities you can stand behind are worth more than five you cannot. If the research is thin, say so in the summary, give fewer opportunities, and set confidence to "low".
- Do not guess employee count or industry from the domain name alone. Leave them null when the research does not support them.
- Set confidence to "high" only when their website loaded and the research clearly explains the business.`;

/** Strict schema, so a malformed brief fails loudly instead of half-saving. */
const RESEARCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "industry",
    "employeeCountEstimate",
    "linkedinUrl",
    "techStack",
    "opportunities",
    "discoveryQuestions",
    "confidence",
  ],
  properties: {
    summary: {
      type: "string",
      description: "Four to six sentences describing the business for a salesperson.",
    },
    industry: { type: ["string", "null"] },
    employeeCountEstimate: { type: ["integer", "null"] },
    linkedinUrl: { type: ["string", "null"] },
    techStack: {
      type: "array",
      items: { type: "string" },
      description: "Named technologies the research actually evidenced. Empty when unknown.",
    },
    opportunities: {
      type: "array",
      minItems: 0,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "observation", "evidence", "proposal", "service", "impact"],
        properties: {
          title: { type: "string" },
          observation: { type: "string" },
          evidence: { type: "string", enum: [...RESEARCH_EVIDENCE_VALUES] },
          proposal: { type: "string" },
          service: { type: "string", enum: SERVICE_LINE_VALUES },
          impact: { type: "string" },
        },
      },
    },
    discoveryQuestions: {
      type: "array",
      maxItems: 4,
      items: { type: "string" },
      description: "Questions to ask on the call that would confirm or kill the opportunities.",
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
} as const;

/** What the lead told us, rendered the way a person would read it. */
export function describeFormContext(submission: EmbedFormSubmission | null): string {
  if (!submission) return "No enquiry form on file for this company.";

  const lines: string[] = [
    `Form type: ${submission.type === "BUSINESSOS" ? "Business OS" : "General enquiry"}`,
    `Contact: ${submission.name} <${submission.email}>`,
  ];

  const add = (label: string, value: string | null | undefined) => {
    if (value) lines.push(`${label}: ${value}`);
  };

  add("Monthly revenue", submission.monthlyRevenue ? REVENUE_LABELS[submission.monthlyRevenue] ?? submission.monthlyRevenue : null);
  add("Budget", submission.budget ? BUDGET_LABELS[submission.budget] ?? submission.budget : null);
  add("Company headcount", submission.companyHeadcount ? HEADCOUNT_LABELS[submission.companyHeadcount] ?? submission.companyHeadcount : null);
  add("Timeline", submission.timeline);
  add("Platform wanted", submission.platform ? PLATFORM_LABELS[submission.platform] ?? submission.platform : null);
  add("Product is", submission.productType ? PRODUCT_TYPE_LABELS[submission.productType] ?? submission.productType : null);

  if (submission.hasExistingCodebase !== null) {
    lines.push(`Has an existing codebase: ${submission.hasExistingCodebase ? "yes" : "no"}`);
  }

  if (submission.servicesNeeded.length > 0) {
    lines.push(`Services they asked for: ${submission.servicesNeeded.map(serviceLabel).join(", ")}`);
  }

  add("What they described needing", submission.otherServiceDescription);
  add("Manual processes they described", submission.manualProcesses);
  add("Came from campaign", submission.utmCampaign);

  return lines.join("\n");
}

function describeServiceLines(): string {
  return SERVICE_LINES.map((line) => `- ${line.value} (${line.label}): ${line.positioning}`).join("\n");
}

function describeScrapedPages(pages: ScrapedPage[]): string {
  if (pages.length === 0) return "Their website could not be read.";

  return pages
    .map((page) => {
      const header = [`URL: ${page.url}`, page.title && `Title: ${page.title}`, page.metaDescription && `Meta description: ${page.metaDescription}`]
        .filter(Boolean)
        .join("\n");

      return `${header}\n---\n${page.text}`;
    })
    .join("\n\n=====\n\n");
}

/** The web is asked about the business, not the domain, so the answer is usable. */
function buildSearchQuery(domain: string, companyName: string): string {
  return `Research the company at the domain ${domain}${companyName ? ` (it goes by "${companyName}")` : ""}. What does the company do, what does it sell and to whom, roughly how many employees does it have and where is it based, who owns it or funds it, and what has it announced or been reported doing in the last two years? Include anything about how it operates internally: hiring, systems it uses, manual or operational bottlenecks, or plans to expand. If you cannot find the company, say so.`;
}

/**
 * Models occasionally emit citation placeholders (U+FFFC) and other
 * non-printing characters, which land in the CRM as visual noise.
 */
function clean(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\uFFFC\uFEFF\u200B-\u200D\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
}

interface SynthesisPayload {
  summary: string;
  industry: string | null;
  employeeCountEstimate: number | null;
  linkedinUrl: string | null;
  techStack: string[];
  opportunities: ResearchOpportunity[];
  discoveryQuestions: string[];
  confidence: ResearchConfidence;
}

export type { ResearchConfidence, ResearchEvidence, ResearchOpportunity } from "@/types/research";

export async function researchCompany(options: {
  domain: string;
  companyName: string;
  submission?: EmbedFormSubmission | null;
}): Promise<{ data: CompanyResearch | null; error: string | null }> {
  const { domain, companyName, submission = null } = options;

  if (!process.env.OPENAI_API_KEY) {
    return { data: null, error: "OPENAI_API_KEY is not configured" };
  }

  try {
    const startedAt = Date.now();
    console.log(`[CompanyResearch] researching ${companyName} (${domain})...`);

    // Reading their site and searching the web are independent, and both are
    // slow, so they run together to keep the pass inside the route's budget.
    console.log("[CompanyResearch] reading their website and searching the web...");
    const [site, search] = await Promise.all([
      scrapeCompanySite({
        domain,
        maxPages: PAGES_TO_READ,
        maxCharsPerPage: MAX_CHARS_PER_PAGE,
      }),
      searchWeb({
        query: buildSearchQuery(domain, companyName),
        depth: "thorough",
        timeoutMs: SEARCH_TIMEOUT_MS,
        maxRetries: 0,
      }).catch((error: unknown) => {
        console.log(
          `[CompanyResearch] web search failed: ${error instanceof Error ? error.message : "unknown error"}`
        );
        return null;
      }),
    ]);

    // A site that will not load is common (Cloudflare, holding pages, typo'd
    // domains) and is not a reason to abandon the research.
    const pages = site.data?.pages ?? [];
    const brand = site.data?.brand ?? null;

    if (!site.data) {
      console.log(`[CompanyResearch] website unreadable (${site.error}), continuing on web research alone`);
    }

    if (pages.length === 0 && !search?.answer) {
      return {
        data: null,
        error: `Nothing could be found for ${domain}: the website did not load and the web search returned nothing`,
      };
    }

    console.log("[CompanyResearch] writing the brief...");
    const input = [
      `# What the lead told us on our form\n${describeFormContext(submission)}`,
      `# Our service lines\n${describeServiceLines()}`,
      // Labelled, because the raw text of a marketing page includes rendered
      // product demos that read exactly like the company's real internal work.
      `# Their website, as raw page text\nThis is their own marketing copy, and any interface mock-ups on the page have been flattened into this text along with the sample records inside them. Treat records, tickets, chat threads and code that appear here as demonstrations of what they sell.\n\n${describeScrapedPages(pages)}`,
      `# Web research\n${search?.answer || "The web search returned nothing usable."}`,
    ].join("\n\n");

    const response = await getOpenAI().responses.create(
      {
        model: MODEL,
        instructions: SYNTHESIS_INSTRUCTIONS,
        input,
        reasoning: { effort: "medium" },
        text: {
          format: {
            type: "json_schema",
            name: "company_research",
            strict: true,
            schema: RESEARCH_SCHEMA as unknown as Record<string, unknown>,
          },
        },
      },
      { timeout: SYNTHESIS_TIMEOUT_MS, maxRetries: SYNTHESIS_MAX_RETRIES }
    );

    const raw = response.output_text?.trim();

    if (!raw) {
      return { data: null, error: "The research model returned an empty brief" };
    }

    const payload = JSON.parse(raw) as SynthesisPayload;
    const summary = clean(payload.summary ?? "");

    if (!summary) {
      return { data: null, error: "The research model returned no summary" };
    }

    const sources = search?.sources ?? [];

    const research: CompanyResearch = {
      summary,
      industry: payload.industry ? clean(payload.industry) || null : null,
      employeeCountEstimate:
        typeof payload.employeeCountEstimate === "number" && payload.employeeCountEstimate > 0
          ? payload.employeeCountEstimate
          : null,
      linkedinUrl: payload.linkedinUrl ? clean(payload.linkedinUrl) || null : null,
      techStack: (payload.techStack ?? []).map(clean).filter(Boolean),
      opportunities: (payload.opportunities ?? []).map((opportunity) => ({
        title: clean(opportunity.title),
        observation: clean(opportunity.observation),
        evidence: opportunity.evidence,
        proposal: clean(opportunity.proposal),
        service: opportunity.service,
        impact: clean(opportunity.impact),
      })),
      discoveryQuestions: (payload.discoveryQuestions ?? []).map(clean).filter(Boolean),
      // Without the open web all we have is their own marketing, which is never
      // enough to be confident about how the business actually runs.
      confidence:
        sources.length === 0 && payload.confidence === "high" ? "medium" : payload.confidence ?? "low",
      sources,
      brand,
      pagesRead: pages.map((page) => page.url),
    };

    console.log(
      `[CompanyResearch] done in ${Math.round((Date.now() - startedAt) / 1000)}s: ${research.opportunities.length} opportunity(ies), confidence ${research.confidence}, ${research.sources.length} source(s)`
    );

    return { data: research, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[CompanyResearch] research failed:", error);
    return { data: null, error: `Company research failed: ${message}` };
  }
}
