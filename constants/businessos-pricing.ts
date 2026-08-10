// Single source of truth for the public BusinessOS pricing page (/businessos-pricing).
// Every figure the page renders lives here so repricing is a one-file edit.

import { formatCurrency } from "@/constants/crm";

/** Shown on the page so a prospect knows how fresh the third-party estimates are. */
export const INFRA_PRICES_VERIFIED_ON = "August 2026";

export const PRICING_CTA_URL = "https://jaro.dev/contact-businessos";

export const BUILD_FEE = 8500;

/** Formatted once so every mention of the build fee moves with it. */
const BUILD_FEE_LABEL = formatCurrency(BUILD_FEE, "USD");

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

export interface HeroStat {
  value: string;
  label: string;
  detail: string;
}

export const HERO_STATS: HeroStat[] = [
  {
    value: BUILD_FEE_LABEL,
    label: "Fixed-price build",
    detail: "Scope agreed on the call, written down the same day",
  },
  {
    value: "$400",
    label: "Care plan per month",
    detail: "Support, fixes and new work, bundled into one number",
  },
  {
    value: "~$94",
    label: "Infrastructure per month",
    detail: "Paid straight to the vendors, in your own accounts",
  },
  {
    value: "100%",
    label: "Yours from day one",
    detail: "Code, IP and accounts, from the first commit",
  },
];

/* -------------------------------------------------------------------------- */
/* How it works                                                               */
/* -------------------------------------------------------------------------- */

export interface HowItWorksStep {
  title: string;
  body: string;
  detail: string;
}

export const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    title: "We scope it on a call",
    body: "We map your operation, agree exactly what gets built, and write it into a one-page scope document before anyone signs anything.",
    detail: "Free, roughly 60 minutes",
  },
  {
    title: "We build it for a fixed price",
    body: `${BUILD_FEE_LABEL}, agreed upfront. If we underestimated the work, that is our problem to absorb, not a change order for you to argue about.`,
    detail: `${BUILD_FEE_LABEL}, 14 days on average`,
  },
  {
    title: "We keep it alive and growing",
    body: "One monthly plan covers support, fixes, small changes and a block of development time for whatever you need next.",
    detail: "From $400 per month",
  },
];

/* -------------------------------------------------------------------------- */
/* Phase 1: the build                                                         */
/* -------------------------------------------------------------------------- */

export const BUILD_INCLUSIONS: string[] = [
  "Scope fixed on the call and written into a one-page document",
  "Base platform, secure logins, roles and your core data model",
  "Every module agreed in the scope document",
  "Two rounds of revisions inside the agreed scope",
  "Launch, a handover session and a recorded walkthrough for your team",
  "30-day defect warranty, because bugs in our code are never your bill",
];

export const BUILD_TERMS: string[] = [
  "100% on signature, before the build starts",
  "Care plan months one to three are signed at the same time, not sold to you later",
  "The timeline starts when payment clears and we have access",
  "Anything outside the scope document is quoted and approved before we touch it",
  "Invoices are due in 7 days",
];

/* -------------------------------------------------------------------------- */
/* Ownership                                                                  */
/* -------------------------------------------------------------------------- */

export interface OwnershipPoint {
  title: string;
  body: string;
}

export const OWNERSHIP_POINTS: OwnershipPoint[] = [
  {
    title: "The repository is yours from the first commit",
    body: "We build inside your GitHub organisation, not ours. You can read every line, clone it, and audit our work at any point during the build rather than waiting for a handover.",
  },
  {
    title: "The IP is yours, with nothing to buy back",
    body: "No licence that expires, no source-code escrow, no buyout fee if you want to take it in-house. You own the intellectual property outright from day one.",
  },
  {
    title: "Every account is in your name",
    body: "Hosting, database, email and AI accounts are created under your company with your billing details. We get invited as collaborators, and you can remove us with two clicks.",
  },
  {
    title: "Built on industry-leading technology, the most common framework on the internet",
    body: "TypeScript, Next.js, PostgreSQL. No proprietary framework only we understand, so any competent developer can pick this up and keep going without us.",
  },
];

/* -------------------------------------------------------------------------- */
/* Phase 2: care plans                                                        */
/* -------------------------------------------------------------------------- */

export interface CareTier {
  id: string;
  name: string;
  price: number;
  tagline: string;
  /** Development hours bundled into the monthly fee. Zero on support-only tiers. */
  includedHours: number;
  /** Rate for work beyond the included hours. */
  overageRate: number;
  recommended?: boolean;
}

export const CARE_TIERS: CareTier[] = [
  {
    id: "essential",
    name: "Essential",
    price: 400,
    tagline: "Support and answers, no development time",
    includedHours: 0,
    overageRate: 195,
  },
  {
    id: "growth",
    name: "Growth",
    price: 2500,
    tagline: "Keep it running and keep improving it",
    includedHours: 16,
    overageRate: 175,
    recommended: true,
  },
  {
    id: "partner",
    name: "Partner",
    price: 9000,
    tagline: "We act as your product team",
    includedHours: 60,
    overageRate: 155,
  },
];

const [ESSENTIAL, GROWTH, PARTNER] = CARE_TIERS;

/**
 * What an hour of development actually costs inside a plan. Kept derived so the
 * page can never advertise a plan that works out dearer than its own overage
 * rate, which is the whole argument for buying a plan at all.
 */
export function effectiveHourlyRate(tier: CareTier): number | null {
  if (!tier.includedHours) return null;
  return Math.round(tier.price / tier.includedHours);
}

function includedHoursLabel(tier: CareTier): string {
  return tier.includedHours ? `${tier.includedHours} hours` : "Not included";
}

/**
 * Matrix rows. `values` aligns by index with `CARE_TIERS`, so the same data
 * drives the desktop comparison table and the stacked cards on mobile.
 */
export interface CareFeatureRow {
  label: string;
  hint?: string;
  values: [string, string, string];
}

export const CARE_FEATURE_ROWS: CareFeatureRow[] = [
  {
    label: "Development time included",
    hint: "Use it for anything: new features, changes, integrations, reports",
    values: [
      includedHoursLabel(ESSENTIAL),
      includedHoursLabel(GROWTH),
      includedHoursLabel(PARTNER),
    ],
  },
  {
    label: "Where you reach us",
    values: [
      "Shared Slack channel and email",
      "Shared Slack channel and email",
      "Shared Slack channel and email",
    ],
  },
  {
    label: "First response",
    hint: "Business hours, Monday to Friday",
    values: ["2 business days", "Next business day", "Same day"],
  },
  {
    label: "Something is broken in production",
    values: ["3 business days", "Within 24 hours", "Within 16 hours"],
  },
  {
    label: "Calls with us",
    values: [
      "Async only",
      "1 x 60 min per month",
      "2 x 60 min plus a quarterly roadmap session",
    ],
  },
  {
    label: "Fixing bugs in code we wrote",
    hint: "Always free, at every tier, for as long as you are with us",
    values: ["Included", "Included", "Included"],
  },
  {
    label: "Copy, config and field changes",
    values: ["Quoted hourly", "Unlimited", "Unlimited"],
  },
  {
    label: "Hosting, monitoring, backups and updates",
    hint: "We manage them; the vendor bills you directly",
    values: ["Managed", "Managed", "Managed"],
  },
  {
    label: "Rate for development work",
    hint: "On Essential there is no included time, so every hour is quoted first",
    values: [
      `$${ESSENTIAL.overageRate}/hr`,
      `$${GROWTH.overageRate}/hr`,
      `$${PARTNER.overageRate}/hr`,
    ],
  },
  {
    label: "Minimum term",
    values: ["3 months", "3 months", "1 month"],
  },
  {
    label: "Discount for paying annually",
    values: ["None", "10%", "15%"],
  },
];

export const CARE_PLAN_FOOTNOTES: string[] = [
  `${GROWTH.name} works out to $${effectiveHourlyRate(GROWTH)} an hour of development and ${PARTNER.name} to $${effectiveHourlyRate(PARTNER)}, against $225 an hour with no plan at all. The plan is always the cheaper way to buy our time.`,
  "Unused development time rolls forward one month and is never refundable.",
  "After the minimum term the plan is monthly, cancel with 30 days notice.",
  "Plan prices rise 5% at each annual renewal, written into the agreement so it is never a surprise.",
];

/* -------------------------------------------------------------------------- */
/* New work after launch                                                      */
/* -------------------------------------------------------------------------- */

export interface FeatureBand {
  /** Which situation the request falls into, not strictly its size in hours. */
  scenario: string;
  pricing: string;
  payment: string;
}

export const FEATURE_BANDS: FeatureBand[] = [
  {
    scenario: "It fits your included hours",
    pricing: `Covered by time you have already paid for: ${GROWTH.includedHours} hours a month on ${GROWTH.name}, ${PARTNER.includedHours} on ${PARTNER.name}`,
    payment: "Already covered",
  },
  {
    scenario: "It runs past your included hours",
    pricing: `Billed at your plan's rate: $${GROWTH.overageRate} on ${GROWTH.name}, $${PARTNER.overageRate} on ${PARTNER.name}, $${ESSENTIAL.overageRate} on ${ESSENTIAL.name}`,
    payment: "On your next monthly invoice",
  },
  {
    scenario: "Quoted work up to $2,000",
    pricing: "Fixed price from our published module rates, agreed before we start",
    payment: "100% once you approve the quote",
  },
  {
    scenario: "Anything over $2,000",
    pricing: "Fixed price with its own written scope document",
    payment: "100% upfront, the same as the build",
  },
];

/* -------------------------------------------------------------------------- */
/* Hourly rates                                                               */
/* -------------------------------------------------------------------------- */

export interface HourlyRate {
  work: string;
  rate: string;
  /** Omitted where a minimum makes no sense, such as a percentage uplift. */
  minimum?: string;
  applies: string;
}

export const HOURLY_RATES: HourlyRate[] = [
  {
    work: `Development on ${ESSENTIAL.name}`,
    rate: `$${ESSENTIAL.overageRate}/hr`,
    minimum: "30 min blocks",
    applies: `${ESSENTIAL.name} includes no development time, so all of it is hourly`,
  },
  {
    work: `Extra hours on ${GROWTH.name}`,
    rate: `$${GROWTH.overageRate}/hr`,
    minimum: "30 min blocks",
    applies: `Past the ${GROWTH.includedHours} hours included in your plan`,
  },
  {
    work: `Extra hours on ${PARTNER.name}`,
    rate: `$${PARTNER.overageRate}/hr`,
    minimum: "30 min blocks",
    applies: `Past the ${PARTNER.includedHours} hours included in your plan`,
  },
  {
    work: "Development without a plan",
    rate: "$225/hr",
    minimum: "2 hours",
    applies: "Scheduled around plan clients, no response guarantee",
  },
  {
    work: "Advisory call without a plan",
    rate: "$250/hr",
    minimum: "1 hour, prepaid",
    applies: "Strategy and architecture sessions, no build attached",
  },
  {
    work: "Rush delivery inside 48 hours",
    rate: "+40% on the quote",
    applies: "Jumping the queue ahead of other work, at any tier",
  },
  {
    work: "Out-of-hours emergency",
    rate: "$350/hr",
    minimum: "2 hours",
    applies: "Evenings and weekends, outside your plan's response times",
  },
];

/* -------------------------------------------------------------------------- */
/* Infrastructure and usage (paid by the client, directly)                    */
/* -------------------------------------------------------------------------- */

export interface InfraItem {
  name: string;
  purpose: string;
  /** How the vendor charges, quoted from their public pricing. */
  vendorPricing: string;
  billing: "Flat fee" | "Usage" | "Free";
  low: number;
  expected: number;
  heavy: number;
}

/**
 * Estimates for a typical BusinessOS build serving roughly 10 to 30 people.
 * `low` is a quiet month, `expected` is what most clients actually see, and
 * `heavy` is a busy system leaning hard on AI features.
 */
export const INFRA_ITEMS: InfraItem[] = [
  {
    name: "Vercel",
    purpose: "Hosting, deployments, global CDN and scheduled jobs",
    vendorPricing: "$20/mo platform fee, includes $20 of usage credit",
    billing: "Flat fee",
    low: 20,
    expected: 20,
    heavy: 60,
  },
  {
    name: "Neon Postgres",
    purpose: "Your database, with backups and point-in-time restore",
    vendorPricing: "$0.106 per compute-hour, $0.35 per GB stored, no minimum",
    billing: "Usage",
    low: 5,
    expected: 18,
    heavy: 70,
  },
  {
    name: "Vercel Blob",
    purpose: "File and document storage",
    vendorPricing: "Metered storage and transfer",
    billing: "Usage",
    low: 1,
    expected: 4,
    heavy: 20,
  },
  {
    name: "Resend",
    purpose: "Transactional email: notifications, invites, alerts",
    vendorPricing: "Free to 3,000 emails/mo, then $20/mo for 50,000",
    billing: "Usage",
    low: 0,
    expected: 20,
    heavy: 35,
  },
  {
    name: "OpenAI",
    purpose: "AI features: summaries, drafting, classification, search",
    vendorPricing: "From $0.20 per million input tokens, billed per token",
    billing: "Usage",
    low: 5,
    expected: 30,
    heavy: 200,
  },
  {
    name: "Domain and DNS",
    purpose: "Your own address for the system",
    vendorPricing: "Roughly $15 per year",
    billing: "Flat fee",
    low: 1,
    expected: 2,
    heavy: 2,
  },
  {
    name: "Logins and permissions",
    purpose: "Authentication, roles and sessions",
    vendorPricing: "Built into your app, not a subscription",
    billing: "Free",
    low: 0,
    expected: 0,
    heavy: 0,
  },
  {
    name: "Error monitoring",
    purpose: "Alerts us the moment something breaks",
    vendorPricing: "Free tier is enough for most builds, $26/mo above it",
    billing: "Free",
    low: 0,
    expected: 0,
    heavy: 26,
  },
];

export interface InfraTotals {
  low: number;
  expected: number;
  heavy: number;
}

export function infraTotals(items: InfraItem[] = INFRA_ITEMS): InfraTotals {
  return items.reduce<InfraTotals>(
    (totals, item) => ({
      low: totals.low + item.low,
      expected: totals.expected + item.expected,
      heavy: totals.heavy + item.heavy,
    }),
    { low: 0, expected: 0, heavy: 0 }
  );
}

export const INFRA_NOTES: string[] = [
  "You hold these accounts and pay the vendors directly. We never resell infrastructure, add a management margin, or see a cent of it.",
  "Not one of these lines charges per user. Adding 40 more people to your team moves this bill by a few dollars, not a few thousand.",
  `Estimates checked against published vendor pricing in ${INFRA_PRICES_VERIFIED_ON}. Vendors change their prices and your usage will vary, so treat these as a realistic budget rather than a quote.`,
];

/* -------------------------------------------------------------------------- */
/* Comparison against a per-seat SaaS stack                                   */
/* -------------------------------------------------------------------------- */

export interface SaasComparisonRow {
  category: string;
  typicalPricing: string;
  lowAtTwentySeats: number;
  highAtTwentySeats: number;
}

/**
 * Deliberately category-level rather than naming vendors: these are the
 * published ranges for the tools a BusinessOS build usually replaces.
 */
export const SAAS_COMPARISON: SaasComparisonRow[] = [
  {
    category: "CRM and sales pipeline",
    typicalPricing: "$50 to $150 per user",
    lowAtTwentySeats: 1000,
    highAtTwentySeats: 3000,
  },
  {
    category: "Project and task management",
    typicalPricing: "$12 to $25 per user",
    lowAtTwentySeats: 240,
    highAtTwentySeats: 500,
  },
  {
    category: "Automation and integration platform",
    typicalPricing: "$50 to $800 per month",
    lowAtTwentySeats: 50,
    highAtTwentySeats: 800,
  },
  {
    category: "Reporting and dashboards",
    typicalPricing: "$20 to $70 per user",
    lowAtTwentySeats: 400,
    highAtTwentySeats: 1400,
  },
  {
    category: "Forms, scheduling and e-signature",
    typicalPricing: "$15 to $30 per user",
    lowAtTwentySeats: 300,
    highAtTwentySeats: 600,
  },
];

export const SAAS_COMPARISON_SEATS = 20;

/* -------------------------------------------------------------------------- */
/* Why the model is in the client's favour                                    */
/* -------------------------------------------------------------------------- */

export interface IncentivePoint {
  title: string;
  body: string;
}

export const INCENTIVE_POINTS: IncentivePoint[] = [
  {
    title: "You can fire us and keep everything",
    body: "You own the code, the IP and the accounts from day one. There is no lever we can pull to trap you, which means the only thing keeping you here is whether the work is good. That is the right amount of pressure for us to be under.",
  },
  {
    title: "We make nothing on your infrastructure",
    body: "You pay the vendors directly at their published rates. If we marked up hosting we would have a quiet reason to over-provision it. We would rather your bill be small and boring.",
  },
  {
    title: "The build price is fixed, so overruns are our problem",
    body: "If the work takes longer than we estimated, we absorb it. You are never handed a surprise invoice because we misjudged our own scope.",
  },
  {
    title: "We never charge you to fix our own mistakes",
    body: "Bugs in code we wrote are free to fix, forever, at every tier. Billing you for our defects would mean profiting from doing the job badly.",
  },
  {
    title: "Included hours, not billable hours",
    body: "On an hourly model, slow work pays better. On ours you buy a block of time, so we are rewarded for shipping your work quickly and getting it right the first time.",
  },
  {
    title: "We do not charge per user",
    body: "Grow from 10 people to 100 and the price does not move. We refuse to build a business model that taxes you for succeeding.",
  },
  {
    title: "Monthly after the minimum term",
    body: "No annual lock-in unless you want the discount for it. The plan has to be worth paying for every single month, and we would rather find that out early.",
  },
];

/* -------------------------------------------------------------------------- */
/* FAQ                                                                        */
/* -------------------------------------------------------------------------- */

export interface PricingFaq {
  question: string;
  answer: string;
}

export const PRICING_FAQS: PricingFaq[] = [
  {
    question: "Who actually owns the code and the IP?",
    answer:
      "You do, completely, from the first commit. We build in a repository inside your GitHub organisation and the intellectual property is yours as it is written. There is no licence to renew, no escrow arrangement, and no fee to pay if you want to take it in-house or hand it to another agency.",
  },
  {
    question: "What happens if we want to leave?",
    answer:
      "You cancel with 30 days notice after the minimum term and keep a working system, the full source code, and every vendor account, because they were all in your name to begin with. We will happily spend your final month's included hours documenting and handing over to whoever comes next.",
  },
  {
    question: "What if Jaro.dev disappears tomorrow?",
    answer:
      "Nothing switches off. Your system runs on your own hosting, database and domain accounts, and it is built in TypeScript, Next.js and PostgreSQL rather than a framework only we understand. Any competent development team can open the repository and carry on.",
  },
  {
    question: "Why not just bill hourly for everything?",
    answer:
      "Because hourly billing pays us more when we work slower, and it puts a meter on every question you want to ask. A monthly plan with included time means we are paid to be efficient, and you never have to weigh up whether a five-minute question is worth the invoice.",
  },
  {
    question: "Where is the line between a bug and a new feature?",
    answer:
      "If it was in the scope document and it does not work as described, it is a bug and we fix it free, at any tier, however long ago we built it. If it works as agreed but you now want it to do something different, that is new work and it comes out of your included hours.",
  },
  {
    question: "Can we take the build without a care plan?",
    answer:
      "The first three months are part of the initial agreement, because handing over brand-new software with no support relationship is how projects quietly rot. After that it is genuinely your choice. Plenty of clients drop to Essential once things are stable, and support without a plan is available at $225 per hour.",
  },
  {
    question: "What if our infrastructure bill suddenly spikes?",
    answer:
      "You will see it before we do, since the accounts are yours. We set spend alerts and hard usage caps on every metered service during the build, and AI features get a monthly ceiling so a runaway process cannot quietly cost you thousands. Investigating a spike is covered by your plan.",
  },
  {
    question: `Why is the build only ${BUILD_FEE_LABEL}?`,
    answer:
      "Because we have built this kind of system many times and we reuse a library of proven modules rather than starting from a blank page. You are paying for the parts that are specific to your business, not for us to reinvent authentication and reporting for the hundredth time.",
  },
];
