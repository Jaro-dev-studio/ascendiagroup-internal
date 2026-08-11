/**
 * Seeds a worked 90 day roadmap for a demo workspace.
 *
 * Strategies are normally produced by Claude from the onboarding answers and the
 * sales call. This script writes an equivalent record straight to the database so
 * the roadmap screens can be demonstrated, edited and pushed to the delivery
 * board before an Anthropic key is connected. It is a demo aid, not application
 * code, and nothing in the app depends on it.
 *
 * Run with: pnpm seed:demo-strategy
 */
import { PrismaClient, type StrategyPhaseKey, type TaskPriority } from "@prisma/client";

const prisma = new PrismaClient();

const PHASES: {
  phase: StrategyPhaseKey;
  title: string;
  objective: string;
  items: {
    title: string;
    description: string;
    category: string;
    priority: TaskPriority;
  }[];
}[] = [
  {
    phase: "DAY_30",
    title: "Fix the foundations and stop the leaks",
    objective:
      "Take clean ownership of every account, establish a measurement baseline, and stop budget being spent on terms that will never convert.",
    items: [
      {
        title: "Complete the Google Ads account audit",
        description:
          "Review campaign structure, search terms, negative keyword coverage and bidding. Document wasted spend over the last 90 days and the quick wins to action first.",
        category: "Google Ads",
        priority: "URGENT",
      },
      {
        title: "Install conversion tracking for calls and form fills",
        description:
          "No reliable baseline exists today. Set up call tracking and form conversion events so every later decision is measured against real patient enquiries rather than clicks.",
        category: "Tracking",
        priority: "URGENT",
      },
      {
        title: "Claim and fully optimise the Google Business Profile",
        description:
          "Categories, opening hours, services, treatment attributes and photography. This is the highest leverage local asset for a London general practice.",
        category: "Google Business Profile",
        priority: "HIGH",
      },
      {
        title: "Technical SEO crawl of brightsmiledental.com",
        description:
          "Site speed, indexation, internal linking and schema. Prioritise anything blocking the implants and veneers pages from ranking.",
        category: "SEO",
        priority: "HIGH",
      },
      {
        title: "Agree the treatment priority and target cost per enquiry",
        description:
          "Confirm with the practice which treatments carry the margin worth advertising, and set the cost per enquiry each campaign is held to.",
        category: "Strategy",
        priority: "MEDIUM",
      },
    ],
  },
  {
    phase: "DAY_60",
    title: "Build visibility on the treatments that pay",
    objective:
      "Turn the implants and veneers pages into genuine ranking assets and restructure paid search around high intent treatment demand.",
    items: [
      {
        title: "Rebuild the dental implants landing page",
        description:
          "The practice flagged implants as the SEO priority. Rewrite for search intent and conversion: pricing guidance, finance options, before and after evidence, and a clear booking path.",
        category: "SEO",
        priority: "HIGH",
      },
      {
        title: "Rebuild the veneers landing page",
        description:
          "Same treatment as implants. Veneers were named as a priority page in the second intake submission.",
        category: "SEO",
        priority: "HIGH",
      },
      {
        title: "Restructure Google Ads into treatment level campaigns",
        description:
          "Split implants, veneers and general dentistry so budget can follow the treatments with the strongest margin, each pointing at its rebuilt landing page.",
        category: "Google Ads",
        priority: "HIGH",
      },
      {
        title: "Launch the review generation routine",
        description:
          "A repeatable post treatment review request. Local pack ranking and paid search conversion rate both move with review volume and recency.",
        category: "Reputation",
        priority: "MEDIUM",
      },
      {
        title: "Publish the first treatment guides",
        description:
          "Two supporting articles per priority treatment, internally linked to the money pages to build topical depth.",
        category: "Content",
        priority: "MEDIUM",
      },
    ],
  },
  {
    phase: "DAY_90",
    title: "Scale what is working and prove the return",
    objective:
      "Move budget behind the proven treatment lines and give the practice a clear monthly view of patient enquiries and cost per enquiry.",
    items: [
      {
        title: "Reallocate budget to the winning treatment campaigns",
        description:
          "With two months of tracked conversion data, shift spend toward the campaigns hitting target cost per enquiry and cut those that are not.",
        category: "Google Ads",
        priority: "HIGH",
      },
      {
        title: "Expand into the surrounding London boroughs",
        description:
          "Once the core catchment is converting, extend location targeting and build the matching local landing pages.",
        category: "SEO",
        priority: "MEDIUM",
      },
      {
        title: "Stand up the monthly performance report",
        description:
          "Enquiries, cost per enquiry, local pack visibility and organic growth on the priority pages, published to the practice portal each month.",
        category: "Reporting",
        priority: "HIGH",
      },
      {
        title: "Run the 90 day review and agree the next quarter",
        description:
          "Review results against the targets set in month one and agree the next quarter's priorities with the practice owner.",
        category: "Strategy",
        priority: "MEDIUM",
      },
    ],
  },
];

async function main() {
  const client = await prisma.client.findFirst({
    where: { name: "Bright Smile Dental" },
    include: { services: true },
  });

  if (!client) {
    throw new Error(
      "No client named 'Bright Smile Dental' found. Adjust the lookup before running."
    );
  }

  const owner = await prisma.user.findFirst({
    where: { role: { in: ["OWNER", "ADMIN"] } },
    orderBy: { createdAt: "asc" },
  });

  const submission = await prisma.onboardingSubmission.findFirst({
    where: { clientId: client.id, status: "PROCESSED" },
    orderBy: { submittedAt: "desc" },
  });

  console.log(`[Seed] writing demo roadmap for ${client.name}...`);

  // Keep the script repeatable.
  await prisma.strategy.deleteMany({
    where: { clientId: client.id, title: { contains: "90 day growth roadmap" } },
  });

  const strategy = await prisma.strategy.create({
    data: {
      clientId: client.id,
      title: "Bright Smile Dental — 90 day growth roadmap",
      status: "APPROVED",
      summary:
        "Bright Smile Dental is a general dentistry practice in London that wants to grow high value treatment enquiries, specifically dental implants and veneers. The account has been running Google Ads without reliable conversion tracking, so the first month is about taking clean ownership, establishing a measurement baseline and stopping wasted spend. Months two and three build the two priority treatment pages into ranking assets, restructure paid search around treatment intent, and then move budget behind whichever lines prove they can hit the agreed cost per enquiry.",
      positioning:
        "A trusted local London practice for life changing treatment rather than a discount provider. The message leads on clinical credibility, patient evidence and transparent pricing with finance options, which is what separates a practice competing on quality from one competing on price.",
      audience:
        "Adults in the practice's London catchment actively researching implants or veneers, typically comparing two or three practices, sensitive to both clinical reassurance and total cost. Secondary audience is existing patients who can be converted into review volume and treatment referrals.",
      risks:
        "The onboarding form did not capture the current monthly budget, the practice's target patient volume, or which competitors they benchmark against, so the 30 day targets are provisional until confirmed on the kickoff call. There is also no conversion tracking history, which means the first 30 days will establish a baseline rather than show growth. Google Ads credentials were supplied, but Google Business Profile ownership has not yet been confirmed as transferred.",
      sourceSubmissionId: submission?.id ?? null,
      generatedAt: new Date(),
      approvedAt: new Date(),
      createdById: owner?.id ?? null,
      phases: {
        create: PHASES.map((phase, phaseIndex) => ({
          phase: phase.phase,
          title: phase.title,
          objective: phase.objective,
          order: phaseIndex,
          items: {
            create: phase.items.map((item, itemIndex) => ({
              title: item.title,
              description: item.description,
              category: item.category,
              priority: item.priority,
              order: itemIndex,
            })),
          },
        })),
      },
    },
    include: { phases: { include: { items: true } } },
  });

  await prisma.activityLog.create({
    data: {
      clientId: client.id,
      actorId: owner?.id ?? null,
      type: "STRATEGY_GENERATED",
      title: "90 day strategy approved",
      description: strategy.title,
      link: `/dashboard/strategies/${strategy.id}`,
    },
  });

  const actions = strategy.phases.reduce(
    (total, phase) => total + phase.items.length,
    0
  );
  console.log(
    `[Seed] created strategy ${strategy.id} with ${strategy.phases.length} phases and ${actions} actions`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
