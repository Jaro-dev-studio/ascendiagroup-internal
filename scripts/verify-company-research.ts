import Module from "node:module";
import type { EmbedFormSubmission } from "@prisma/client";

/**
 * Runs the real research agent against real domains, the way the form pipeline
 * runs it, so a broken scrape, an unreachable search model or a malformed brief
 * shows up here instead of on a live lead.
 *
 * Usage: pnpm research:verify [domain]
 */

// A few modules reached through the research path are guarded by `server-only`,
// which only understands the Next bundler. Outside it the guard always throws.
const loadModule = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function patched(
  ...args: unknown[]
) {
  if (args[0] === "server-only") return {};
  return loadModule.apply(this, args);
};

const BASE_SUBMISSION = {
  id: "verify-submission",
  type: "BUSINESSOS",
  name: "Verify Tester",
  email: "tester@example.com",
  timeline: null,
  hasExistingCodebase: true,
  budget: null,
  monthlyRevenue: "150-300k",
  productType: "internal",
  platform: "web",
  servicesNeeded: ["ai-automation", "custom-software-autopilot"],
  otherServiceDescription: null,
  companyHeadcount: "51-200",
  manualProcesses: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  redirectedTo: null,
  ipAddress: null,
  userAgent: null,
  referrer: null,
  facebookLeadId: null,
  emailValidation: null,
  firstName: null,
  lastName: null,
  attioRecordId: null,
  errors: [],
  companyId: null,
  personId: null,
  createdAt: new Date(),
} as unknown as EmbedFormSubmission;

/** A lead who told us nothing beyond the required fields. */
const THIN_SUBMISSION = BASE_SUBMISSION;

/** A lead who described their own manual work, the strongest signal we get. */
const DETAILED_SUBMISSION = {
  ...BASE_SUBMISSION,
  manualProcesses:
    "Our ops team copies order details between our supplier portal and our accounting system by hand every morning, and quotes are built in spreadsheets.",
} as unknown as EmbedFormSubmission;

interface Case {
  domain: string;
  submission: EmbedFormSubmission;
  /**
   * Strings that must not appear anywhere in the brief. These pin real
   * confabulations: linear.app's homepage renders a mock of their own product
   * containing an invented issue about a car app's startup sync, which the
   * agent used to report as Linear's own engineering problem.
   */
  forbidden?: string[];
}

const CASES: Case[] = [
  {
    domain: "linear.app",
    submission: THIN_SUBMISSION,
    forbidden: ["vehicle_state", "HomeScreen", "the car disappeared"],
  },
  { domain: "monzo.com", submission: DETAILED_SUBMISSION },
];

function record(name: string, ok: boolean, detail: string): boolean {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${detail}`);
  return ok;
}

async function main(): Promise<void> {
  const { researchCompany } = await import("../lib/research/company-research");
  const { SERVICE_LINE_VALUES } = await import("../constants/services");
  const { RESEARCH_EVIDENCE_VALUES } = await import("../constants/research");

  const cases = process.argv[2]
    ? CASES.filter((entry) => entry.domain === process.argv[2])
    : CASES;

  if (cases.length === 0) {
    console.error(`No verification case for "${process.argv[2]}". Known: ${CASES.map((entry) => entry.domain).join(", ")}`);
    process.exit(1);
  }

  const results: boolean[] = [];

  for (const { domain, submission, forbidden } of cases) {
    console.log(`\n=== ${domain} (${submission.manualProcesses ? "detailed" : "thin"} form) ===\n`);

    const started = Date.now();
    const { data, error } = await researchCompany({
      domain,
      companyName: domain.split(".")[0],
      submission,
    });

    if (!data) {
      results.push(record(`${domain}: research returns a brief`, false, error ?? "no data"));
      continue;
    }

    console.log(`Took ${Math.round((Date.now() - started) / 1000)}s\n`);
    console.log(`SUMMARY\n${data.summary}\n`);
    console.log("OPPORTUNITIES");
    for (const opportunity of data.opportunities) {
      console.log(`\n  ${opportunity.title}  [${opportunity.service}]`);
      console.log(`    found:    (${opportunity.evidence}) ${opportunity.observation}`);
      console.log(`    build:    ${opportunity.proposal}`);
      console.log(`    impact:   ${opportunity.impact}`);
    }
    console.log(`\nQUESTIONS\n${data.discoveryQuestions.map((q) => `  - ${q}`).join("\n")}`);
    console.log(`\nBRAND: ${JSON.stringify(data.brand)}`);
    console.log(`PAGES READ: ${data.pagesRead.join(", ") || "none"}`);
    console.log(`SOURCES: ${data.sources.map((source) => source.url).join(", ") || "none"}\n`);

    results.push(
      record(`${domain}: reads their website`, data.pagesRead.length > 0, `${data.pagesRead.length} page(s)`)
    );

    results.push(
      record(
        `${domain}: brand scraped from their site`,
        Boolean(data.brand?.primaryColor),
        data.brand ? `primary ${data.brand.primaryColor}, logo ${data.brand.logoUrl ? "found" : "none"}` : "no brand"
      )
    );

    results.push(
      record(
        `${domain}: web research cites sources`,
        data.sources.length > 0 && data.sources.every((source) => source.url.startsWith("http")),
        `${data.sources.length} source(s)`
      )
    );

    results.push(
      record(
        `${domain}: summary describes the business`,
        data.summary.length > 200,
        `${data.summary.length} chars`
      )
    );

    results.push(
      record(
        `${domain}: proposes at least two opportunities`,
        data.opportunities.length >= 2,
        `${data.opportunities.length} opportunity(ies)`
      )
    );

    results.push(
      record(
        `${domain}: every opportunity maps to a real service line`,
        data.opportunities.every((opportunity) =>
          (SERVICE_LINE_VALUES as string[]).includes(opportunity.service)
        ),
        data.opportunities.map((opportunity) => opportunity.service).join(", ") || "none"
      )
    );

    results.push(
      record(
        `${domain}: every opportunity is grounded in an observation`,
        data.opportunities.every(
          (opportunity) => opportunity.observation.trim().length > 40 && opportunity.proposal.trim().length > 40
        ),
        "observations and proposals are specific"
      )
    );

    results.push(
      record(
        `${domain}: every opportunity declares where its evidence came from`,
        data.opportunities.every((opportunity) =>
          (RESEARCH_EVIDENCE_VALUES as readonly string[]).includes(opportunity.evidence)
        ),
        data.opportunities.map((opportunity) => opportunity.evidence).join(", ") || "none"
      )
    );

    // Both fixtures tick AI & Automation and Autopilot, so the brief should
    // lead with what they actually asked for.
    results.push(
      record(
        `${domain}: honours the services the lead asked for`,
        data.opportunities.some((opportunity) =>
          ["ai-automation", "custom-software-autopilot"].includes(opportunity.service)
        ),
        data.opportunities.map((opportunity) => opportunity.service).join(", ") || "none"
      )
    );

    if (forbidden?.length) {
      const brief = JSON.stringify(data).toLowerCase();
      const found = forbidden.filter((needle) => brief.includes(needle.toLowerCase()));

      results.push(
        record(
          `${domain}: does not mistake their product demo for their own problems`,
          found.length === 0,
          found.length === 0 ? "none of the sample data leaked in" : `leaked: ${found.join(", ")}`
        )
      );
    }

    results.push(
      record(
        `${domain}: reports a confidence level`,
        ["high", "medium", "low"].includes(data.confidence),
        data.confidence
      )
    );
  }

  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("[Verify] company research verification failed:", error);
  process.exit(1);
});
