import { z } from "zod";

// Schema for a single part (deliverable) within a module.
// Parts let a module be split into smaller, priced pieces — each with a clear
// objective describing the business problem it fixes. The sum of all part prices
// equals the module's basePrice.
export const modulePartSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  objective: z.string(),
});

export type ModulePart = z.infer<typeof modulePartSchema>;

// Schema for a module pricing entry
export const modulePricingSchema = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
  basePrice: z.number(),
  multiplier: z.number().optional(),
  multiplierPer: z.string().optional(),
  isTemplated: z.boolean().optional(),
  benefit: z.string().optional(),
  parts: z.array(modulePartSchema).optional(),
});

export type ModulePricing = z.infer<typeof modulePricingSchema>;

// A part as it appears on a quote line item (with its included/excluded state)
export interface QuoteLinePart {
  id: string;
  name: string;
  price: number;
  objective: string;
  included: boolean;
}

// Quote line item
export interface QuoteLineItem {
  code: string;
  module: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  parts?: QuoteLinePart[];
}

// Full quote
export interface Quote {
  lineItems: QuoteLineItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  deposit: number; // 20%
  balance: number; // 80%
}

// Always-included base modules
export const baseModules: Record<string, ModulePricing & { isRequired: boolean }> = {
  BASE: {
    code: "BASE",
    name: "Base Platform Build",
    category: "Platform Foundation",
    basePrice: 2000,
    benefit:
      "the foundation of your custom software application with core infrastructure and architecture",
    isRequired: true,
    parts: [
      {
        id: "BASE-infra",
        name: "Architecture & infrastructure setup",
        price: 1200,
        objective:
          "Stand up a secure, scalable foundation so your whole system runs reliably from day one",
      },
      {
        id: "BASE-data",
        name: "Core data model & environments",
        price: 800,
        objective:
          "Model your business data correctly so every feature builds on a solid, consistent base",
      },
    ],
  },
  USER: {
    code: "USER",
    name: "User Management System",
    category: "Platform Foundation",
    basePrice: 750,
    benefit:
      "so your team has secure access with roles, permissions, and authentication built-in",
    isRequired: true,
    parts: [
      {
        id: "USER-auth",
        name: "Authentication & accounts",
        price: 450,
        objective: "Give your team secure logins so the right people access the system safely",
      },
      {
        id: "USER-roles",
        name: "Roles & permissions",
        price: 300,
        objective: "Control who can see and do what so sensitive data stays protected",
      },
    ],
  },
};

// Module Pricing Matrix from the BusinessOS Sales Playbook (prices halved).
// Each module is split into parts with clear objectives that add up to basePrice.
export const modulePricing: Record<string, ModulePricing> = {
  // Marketing & Lead Generation Modules
  M01: {
    code: "M01",
    name: "Attribution Tracking Setup",
    category: "Marketing & Lead Generation",
    basePrice: 2000,
    multiplier: 1500,
    multiplierPer: "ad platform",
    benefit:
      "so you know exactly which channels are profitable and where to invest your marketing budget",
    parts: [
      {
        id: "M01-tracking",
        name: "Tracking & pixel implementation",
        price: 1200,
        objective: "Install tracking across your site so every visitor and conversion is captured",
      },
      {
        id: "M01-model",
        name: "Attribution reporting model",
        price: 800,
        objective: "Connect spend to revenue so you know which channels actually make money",
      },
    ],
  },
  M02: {
    code: "M02",
    name: "Lead Capture System",
    category: "Marketing & Lead Generation",
    basePrice: 1500,
    multiplier: 500,
    multiplierPer: "form/landing page",
    benefit: "so every lead is captured automatically and nothing slips through the cracks",
    parts: [
      {
        id: "M02-forms",
        name: "Form & capture setup",
        price: 900,
        objective: "Build lead forms that capture every inquiry so no lead is lost",
      },
      {
        id: "M02-routing",
        name: "CRM routing & auto-assignment",
        price: 600,
        objective: "Route new leads instantly so they're followed up before they go cold",
      },
    ],
  },
  M03: {
    code: "M03",
    name: "CRM Integration (Marketing)",
    category: "Marketing & Lead Generation",
    basePrice: 2500,
    multiplier: 1000,
    multiplierPer: "marketing tool",
    benefit:
      "so your marketing and sales data are connected and you can see the full customer journey",
    parts: [
      {
        id: "M03-sync",
        name: "Bi-directional CRM sync",
        price: 1500,
        objective: "Connect marketing tools to your CRM so data flows automatically without manual export",
      },
      {
        id: "M03-timeline",
        name: "Unified contact timeline",
        price: 1000,
        objective: "See every touchpoint in one place so you understand the full customer journey",
      },
    ],
  },
  M04: {
    code: "M04",
    name: "Email Automation Setup",
    category: "Marketing & Lead Generation",
    basePrice: 2000,
    multiplier: 300,
    multiplierPer: "sequence",
    benefit: "so leads are nurtured automatically and you stay top of mind without manual follow-up",
    parts: [
      {
        id: "M04-platform",
        name: "Email platform & deliverability setup",
        price: 1100,
        objective: "Set up your email engine so messages reliably land in the inbox",
      },
      {
        id: "M04-sequences",
        name: "Nurture sequence build",
        price: 900,
        objective: "Automate follow-up so leads are nurtured without manual effort",
      },
    ],
  },
  M05: {
    code: "M05",
    name: "Lead Scoring System",
    category: "Marketing & Lead Generation",
    basePrice: 3000,
    benefit: "so your team focuses on the hottest leads first and stops wasting time on tire-kickers",
    parts: [
      {
        id: "M05-model",
        name: "Scoring model design",
        price: 1600,
        objective: "Define what a hot lead looks like so your team knows who to prioritize",
      },
      {
        id: "M05-alerts",
        name: "Automated scoring & alerts",
        price: 1400,
        objective: "Score and flag leads automatically so reps focus on the best opportunities",
      },
    ],
  },
  M06: {
    code: "M06",
    name: "Marketing Dashboard",
    category: "Marketing & Lead Generation",
    basePrice: 2500,
    multiplier: 500,
    multiplierPer: "data source",
    benefit: "so you can see all your marketing performance in one place and make data-driven decisions",
    parts: [
      {
        id: "M06-sources",
        name: "Data source connections",
        price: 1200,
        objective: "Pull all your marketing data together so nothing lives in silos",
      },
      {
        id: "M06-dashboard",
        name: "Dashboard & reporting build",
        price: 1300,
        objective: "Visualize performance in one view so you can make data-driven decisions fast",
      },
    ],
  },
  M07: {
    code: "M07",
    name: "UTM/Tracking Framework",
    category: "Marketing & Lead Generation",
    basePrice: 1000,
    benefit: "so every campaign is properly tagged and you can trace revenue back to specific efforts",
    parts: [
      {
        id: "M07-taxonomy",
        name: "UTM taxonomy & naming standard",
        price: 500,
        objective: "Standardize campaign tagging so every effort is trackable",
      },
      {
        id: "M07-rollout",
        name: "Tracking template rollout",
        price: 500,
        objective: "Roll out reusable tracking so revenue traces back to specific campaigns",
      },
    ],
  },

  // Sales Operations Modules
  S01: {
    code: "S01",
    name: "CRM Setup & Migration",
    category: "Sales Operations",
    basePrice: 3000,
    multiplier: 500,
    multiplierPer: "1,000 records",
    benefit: "so all your deals are tracked in one place and nothing falls through the cracks",
    parts: [
      {
        id: "S01-config",
        name: "CRM configuration",
        price: 1500,
        objective: "Configure your CRM around your sales process so it fits how you actually sell",
      },
      {
        id: "S01-migration",
        name: "Data migration & cleanup",
        price: 900,
        objective: "Bring your existing contacts in clean so nothing is lost or duplicated",
      },
      {
        id: "S01-training",
        name: "Team training & adoption",
        price: 600,
        objective: "Get your team using it consistently so the pipeline stays accurate",
      },
    ],
  },
  S02: {
    code: "S02",
    name: "Pipeline Configuration",
    category: "Sales Operations",
    basePrice: 2000,
    multiplier: 500,
    multiplierPer: "pipeline",
    benefit: "so everyone knows exactly where each deal stands and what needs to happen next",
    parts: [
      {
        id: "S02-stages",
        name: "Stage & exit-criteria design",
        price: 1100,
        objective: "Define clear pipeline stages so everyone knows where each deal stands",
      },
      {
        id: "S02-automation",
        name: "Automation & pipeline views",
        price: 900,
        objective: "Automate stage movement and views so deals keep progressing",
      },
    ],
  },
  S03: {
    code: "S03",
    name: "Proposal/Quote Automation",
    category: "Sales Operations",
    basePrice: 2500,
    multiplier: 300,
    multiplierPer: "template",
    benefit: "so you can send professional proposals in minutes instead of hours",
    parts: [
      {
        id: "S03-templates",
        name: "Template & branding build",
        price: 1300,
        objective: "Create professional proposal templates so quotes look consistent and polished",
      },
      {
        id: "S03-generation",
        name: "Auto-generation from CRM",
        price: 1200,
        objective: "Generate proposals from deal data so they go out in minutes not hours",
      },
    ],
  },
  S04: {
    code: "S04",
    name: "E-Signature Integration",
    category: "Sales Operations",
    basePrice: 1500,
    benefit: "so contracts get signed faster and deals close without the email back-and-forth",
    parts: [
      {
        id: "S04-integration",
        name: "E-signature integration",
        price: 900,
        objective: "Enable digital signing so contracts get signed without printing or scanning",
      },
      {
        id: "S04-workflow",
        name: "Contract workflow & tracking",
        price: 600,
        objective: "Track signature status so you know exactly where each contract stands",
      },
    ],
  },
  S05: {
    code: "S05",
    name: "Sales Email Templates",
    category: "Sales Operations",
    basePrice: 1000,
    multiplier: 100,
    multiplierPer: "template",
    benefit: "so your team sends consistent, professional emails with less effort",
    parts: [
      {
        id: "S05-library",
        name: "Template library setup",
        price: 600,
        objective: "Build a reusable email library so reps send consistent, on-brand messages",
      },
      {
        id: "S05-merge",
        name: "Snippet & merge-field config",
        price: 400,
        objective: "Add personalization fields so templates feel tailored with less effort",
      },
    ],
  },
  S06: {
    code: "S06",
    name: "Meeting Scheduler Setup",
    category: "Sales Operations",
    basePrice: 800,
    multiplier: 200,
    multiplierPer: "rep",
    benefit: "so prospects can book time directly and you eliminate the scheduling back-and-forth",
    parts: [
      {
        id: "S06-scheduler",
        name: "Scheduler setup & calendar sync",
        price: 500,
        objective: "Let prospects book directly so you eliminate scheduling back-and-forth",
      },
      {
        id: "S06-reminders",
        name: "Routing & reminder automation",
        price: 300,
        objective: "Route and remind automatically so meetings actually happen",
      },
    ],
  },
  S07: {
    code: "S07",
    name: "Activity Auto-Logging",
    category: "Sales Operations",
    basePrice: 2000,
    multiplier: 500,
    multiplierPer: "integration",
    benefit: "so all calls, emails, and meetings are logged automatically without manual entry",
    parts: [
      {
        id: "S07-logging",
        name: "Email & calendar logging",
        price: 1100,
        objective: "Log calls, emails and meetings automatically so reps stop doing data entry",
      },
      {
        id: "S07-sync",
        name: "CRM activity sync",
        price: 900,
        objective: "Sync all activity to the CRM so nothing is missed or forgotten",
      },
    ],
  },
  S08: {
    code: "S08",
    name: "Sales Dashboard/Forecasting",
    category: "Sales Operations",
    basePrice: 3500,
    multiplier: 500,
    multiplierPer: "report",
    benefit: "so you can see pipeline health and forecast revenue accurately",
    parts: [
      {
        id: "S08-dashboards",
        name: "Pipeline & KPI dashboards",
        price: 1800,
        objective: "See pipeline health at a glance so you spot problems early",
      },
      {
        id: "S08-forecast",
        name: "Forecasting model",
        price: 1700,
        objective: "Forecast revenue accurately so you can plan with confidence",
      },
    ],
  },
  S09: {
    code: "S09",
    name: "Win/Loss Analysis System",
    category: "Sales Operations",
    basePrice: 2000,
    benefit: "so you understand why deals are won or lost and can improve your close rate",
    parts: [
      {
        id: "S09-tracking",
        name: "Win/loss tracking setup",
        price: 1100,
        objective: "Capture why deals are won or lost so patterns become visible",
      },
      {
        id: "S09-insights",
        name: "Insights & reporting",
        price: 900,
        objective: "Turn reasons into insights so you can improve your close rate",
      },
    ],
  },

  // Delivery & Fulfillment Modules
  D01: {
    code: "D01",
    name: "Client Onboarding System",
    category: "Delivery & Fulfillment",
    basePrice: 2500,
    multiplier: 400,
    multiplierPer: "onboarding type",
    benefit: "so every new client gets a consistent, professional experience from day one",
    parts: [
      {
        id: "D01-workflow",
        name: "Onboarding workflow build",
        price: 1400,
        objective: "Standardize onboarding so every client gets a consistent start",
      },
      {
        id: "D01-templates",
        name: "Templates & automation",
        price: 1100,
        objective: "Automate kickoff steps so nothing is forgotten and clients feel taken care of",
      },
    ],
  },
  D02: {
    code: "D02",
    name: "Project/Order Management",
    category: "Delivery & Fulfillment",
    basePrice: 3500,
    multiplier: 500,
    multiplierPer: "workflow",
    benefit: "so all projects are tracked in one place with clear visibility on status and deadlines",
    parts: [
      {
        id: "D02-workspace",
        name: "Project workspace setup",
        price: 1500,
        objective: "Track all projects in one system so nothing falls through the cracks",
      },
      {
        id: "D02-tasks",
        name: "Task, deadline & dependency config",
        price: 1200,
        objective: "Map tasks and deadlines so delivery stays on schedule",
      },
      {
        id: "D02-visibility",
        name: "Status visibility & reporting",
        price: 800,
        objective: "Give clear status visibility so everyone knows where things stand",
      },
    ],
  },
  D03: {
    code: "D03",
    name: "Client Portal Setup",
    category: "Delivery & Fulfillment",
    basePrice: 4000,
    benefit: "so clients can see their project status anytime without having to ask",
    parts: [
      {
        id: "D03-portal",
        name: "Portal build & branding",
        price: 2200,
        objective: "Give clients a branded portal so they can self-serve information",
      },
      {
        id: "D03-views",
        name: "Access, docs & status views",
        price: 1800,
        objective: "Show project status and files so clients stop asking 'where are we?'",
      },
    ],
  },
  D04: {
    code: "D04",
    name: "Automated Status Updates",
    category: "Delivery & Fulfillment",
    basePrice: 1500,
    multiplier: 300,
    multiplierPer: "notification type",
    benefit: "so clients are kept in the loop automatically and you reduce check-in emails",
    parts: [
      {
        id: "D04-notifications",
        name: "Notification setup",
        price: 800,
        objective: "Automate status notifications so clients stay informed without chasing",
      },
      {
        id: "D04-triggers",
        name: "Trigger & scheduling config",
        price: 700,
        objective: "Trigger updates at the right moments so communication feels proactive",
      },
    ],
  },
  D05: {
    code: "D05",
    name: "Time Tracking Integration",
    category: "Delivery & Fulfillment",
    basePrice: 1500,
    multiplier: 200,
    multiplierPer: "team",
    benefit: "so you know exactly where time is going and can bill accurately",
    parts: [
      {
        id: "D05-tracking",
        name: "Time tracking integration",
        price: 900,
        objective: "Track time against work so you know where hours actually go",
      },
      {
        id: "D05-billing",
        name: "Billing & reporting sync",
        price: 600,
        objective: "Feed time into billing so invoices are accurate",
      },
    ],
  },
  D06: {
    code: "D06",
    name: "Scope Change System",
    category: "Delivery & Fulfillment",
    basePrice: 1500,
    benefit: "so scope changes are documented and approved before work begins",
    parts: [
      {
        id: "D06-requests",
        name: "Change request workflow",
        price: 900,
        objective: "Document scope changes so nothing extra is done without approval",
      },
      {
        id: "D06-approval",
        name: "Approval & tracking",
        price: 600,
        objective: "Approve and track changes so margins are protected",
      },
    ],
  },
  D07: {
    code: "D07",
    name: "QA/Approval Workflows",
    category: "Delivery & Fulfillment",
    basePrice: 2000,
    multiplier: 300,
    multiplierPer: "workflow",
    benefit: "so nothing goes to clients without proper review and sign-off",
    parts: [
      {
        id: "D07-checkpoints",
        name: "QA checkpoint setup",
        price: 1100,
        objective: "Add quality checkpoints so nothing reaches clients unchecked",
      },
      {
        id: "D07-routing",
        name: "Approval routing",
        price: 900,
        objective: "Route work for sign-off so accountability is clear",
      },
    ],
  },
  D08: {
    code: "D08",
    name: "Sales-to-Delivery Handoff",
    category: "Delivery & Fulfillment",
    basePrice: 2500,
    benefit: "so all client context transfers automatically and delivery starts smoothly",
    parts: [
      {
        id: "D08-handoff",
        name: "Handoff automation",
        price: 1400,
        objective: "Transfer all client context automatically so delivery starts without re-gathering info",
      },
      {
        id: "D08-kickoff",
        name: "Kickoff trigger & checklist",
        price: 1100,
        objective: "Trigger a clean kickoff so projects start smoothly every time",
      },
    ],
  },

  // Customer Success Modules
  C01: {
    code: "C01",
    name: "Customer Health Scoring",
    category: "Customer Success",
    basePrice: 3000,
    multiplier: 500,
    multiplierPer: "health metric",
    benefit: "so you can spot at-risk customers early and prevent churn before it happens",
    parts: [
      {
        id: "C01-model",
        name: "Health model design",
        price: 1600,
        objective: "Define health signals so at-risk customers are identified early",
      },
      {
        id: "C01-alerting",
        name: "Scoring & alerting",
        price: 1400,
        objective: "Score and alert automatically so you can intervene before churn",
      },
    ],
  },
  C02: {
    code: "C02",
    name: "Renewal Management System",
    category: "Customer Success",
    basePrice: 2500,
    multiplier: 300,
    multiplierPer: "renewal type",
    benefit: "so renewals are proactive and you never miss a contract expiration",
    parts: [
      {
        id: "C02-tracking",
        name: "Renewal tracking setup",
        price: 1400,
        objective: "Track all renewal dates so you never miss an expiration",
      },
      {
        id: "C02-outreach",
        name: "Proactive outreach automation",
        price: 1100,
        objective: "Automate early outreach so renewals happen proactively",
      },
    ],
  },
  C03: {
    code: "C03",
    name: "NPS/CSAT Automation",
    category: "Customer Success",
    basePrice: 1500,
    multiplier: 200,
    multiplierPer: "survey",
    benefit: "so you systematically collect feedback and catch issues before they escalate",
    parts: [
      {
        id: "C03-surveys",
        name: "Survey setup & delivery",
        price: 800,
        objective: "Automate satisfaction surveys so you collect feedback systematically",
      },
      {
        id: "C03-routing",
        name: "Feedback routing & alerts",
        price: 700,
        objective: "Route feedback and flag issues so problems are caught early",
      },
    ],
  },
  C04: {
    code: "C04",
    name: "Upsell Trigger System",
    category: "Customer Success",
    basePrice: 2500,
    multiplier: 400,
    multiplierPer: "trigger",
    benefit: "so you automatically identify expansion opportunities with existing customers",
    parts: [
      {
        id: "C04-logic",
        name: "Trigger logic design",
        price: 1300,
        objective: "Define expansion signals so upsell moments are never missed",
      },
      {
        id: "C04-playbooks",
        name: "Automated alerts & playbooks",
        price: 1200,
        objective: "Alert the team automatically so opportunities turn into revenue",
      },
    ],
  },
  C05: {
    code: "C05",
    name: "Account Plan Templates",
    category: "Customer Success",
    basePrice: 1500,
    multiplier: 200,
    multiplierPer: "template",
    benefit: "so you have a structured approach to growing key accounts",
    parts: [
      {
        id: "C05-templates",
        name: "Account plan templates",
        price: 800,
        objective: "Give a structured plan so key accounts are grown intentionally",
      },
      {
        id: "C05-cadence",
        name: "Review cadence setup",
        price: 700,
        objective: "Set a review rhythm so account plans stay active",
      },
    ],
  },
  C06: {
    code: "C06",
    name: "Referral Program Setup",
    category: "Customer Success",
    basePrice: 2000,
    multiplier: 300,
    multiplierPer: "incentive tier",
    benefit: "so happy customers become a predictable source of new business",
    parts: [
      {
        id: "C06-workflow",
        name: "Referral workflow build",
        price: 1100,
        objective: "Build a referral system so happy customers send you new business",
      },
      {
        id: "C06-incentives",
        name: "Incentive & tracking setup",
        price: 900,
        objective: "Track referrals and rewards so the program actually runs",
      },
    ],
  },

  // Finance & Admin Modules
  F01: {
    code: "F01",
    name: "Auto-Invoice Generation",
    category: "Finance & Admin",
    basePrice: 2500,
    multiplier: 400,
    multiplierPer: "invoice type",
    benefit: "so invoices go out automatically and you get paid faster",
    parts: [
      {
        id: "F01-templates",
        name: "Invoice template & rules setup",
        price: 1400,
        objective: "Automate invoice creation so billing goes out without manual work",
      },
      {
        id: "F01-sync",
        name: "CRM/project data sync",
        price: 1100,
        objective: "Pull invoice data from your system so invoices are accurate and fast",
      },
    ],
  },
  F02: {
    code: "F02",
    name: "Payment Gateway Integration",
    category: "Finance & Admin",
    basePrice: 1500,
    multiplier: 500,
    multiplierPer: "gateway",
    benefit: "so clients can pay online with one click and you reduce payment friction",
    parts: [
      {
        id: "F02-gateway",
        name: "Gateway integration",
        price: 900,
        objective: "Enable online payments so clients can pay in one click",
      },
      {
        id: "F02-reconciliation",
        name: "Reconciliation setup",
        price: 600,
        objective: "Match payments to invoices so your books stay clean",
      },
    ],
  },
  F03: {
    code: "F03",
    name: "Payment Reminder Automation",
    category: "Finance & Admin",
    basePrice: 1000,
    benefit: "so overdue invoices are followed up automatically without awkward conversations",
    parts: [
      {
        id: "F03-reminders",
        name: "Reminder sequence setup",
        price: 600,
        objective: "Automate overdue reminders so you get paid without awkward calls",
      },
      {
        id: "F03-escalation",
        name: "Escalation rules",
        price: 400,
        objective: "Escalate late payments automatically so nothing is ignored",
      },
    ],
  },
  F04: {
    code: "F04",
    name: "Recurring Billing Setup",
    category: "Finance & Admin",
    basePrice: 2000,
    multiplier: 300,
    multiplierPer: "billing cycle type",
    benefit: "so subscription and retainer billing happens automatically each period",
    parts: [
      {
        id: "F04-subscriptions",
        name: "Subscription billing setup",
        price: 1100,
        objective: "Automate recurring charges so retainer revenue collects itself",
      },
      {
        id: "F04-dunning",
        name: "Dunning & failed-payment handling",
        price: 900,
        objective: "Recover failed payments automatically so revenue doesn't leak",
      },
    ],
  },
  F05: {
    code: "F05",
    name: "Profitability Dashboard",
    category: "Finance & Admin",
    basePrice: 3500,
    multiplier: 500,
    multiplierPer: "dimension",
    benefit: "so you can see which clients and projects are actually making you money",
    parts: [
      {
        id: "F05-model",
        name: "Cost & revenue data model",
        price: 1800,
        objective: "Bring cost and revenue together so true profit is visible",
      },
      {
        id: "F05-dashboards",
        name: "Profit dashboards",
        price: 1700,
        objective: "Show margins per client and project so you fix unprofitable work",
      },
    ],
  },
  F06: {
    code: "F06",
    name: "Expense Tracking System",
    category: "Finance & Admin",
    basePrice: 2000,
    multiplier: 300,
    multiplierPer: "category",
    benefit: "so project costs are tracked automatically and you know your true margins",
    parts: [
      {
        id: "F06-capture",
        name: "Expense capture setup",
        price: 1100,
        objective: "Track expenses against projects so real costs are always known",
      },
      {
        id: "F06-reporting",
        name: "Categorization & reporting",
        price: 900,
        objective: "Categorize spend so you understand your true margins",
      },
    ],
  },
  F07: {
    code: "F07",
    name: "Accounting Integration",
    category: "Finance & Admin",
    basePrice: 2500,
    multiplier: 500,
    multiplierPer: "accounting system",
    benefit: "so your books sync automatically and month-end close is faster",
    parts: [
      {
        id: "F07-sync",
        name: "Accounting sync setup",
        price: 1400,
        objective: "Sync data to your accounting system so month-end close is faster",
      },
      {
        id: "F07-reconciliation",
        name: "Reconciliation & reporting",
        price: 1100,
        objective: "Automate reconciliation so your books stay accurate",
      },
    ],
  },

  // Integration & Platform Modules
  I01: {
    code: "I01",
    name: "Meta Ads Integration",
    category: "Integration & Platform",
    basePrice: 1500,
    isTemplated: true,
    benefit: "so your Facebook and Instagram ad data flows directly into your CRM",
    parts: [
      {
        id: "I01-connection",
        name: "Meta Ads connection",
        price: 900,
        objective: "Connect Meta ad data so Facebook/Instagram spend links to results",
      },
      {
        id: "I01-mapping",
        name: "Data mapping & sync",
        price: 600,
        objective: "Map ad data into your CRM so campaigns tie to real outcomes",
      },
    ],
  },
  I02: {
    code: "I02",
    name: "Google Ads Integration",
    category: "Integration & Platform",
    basePrice: 1500,
    isTemplated: true,
    benefit: "so your Google Ads performance connects to actual sales outcomes",
    parts: [
      {
        id: "I02-connection",
        name: "Google Ads connection",
        price: 900,
        objective: "Connect Google Ads so ad performance links to actual sales",
      },
      {
        id: "I02-mapping",
        name: "Conversion mapping",
        price: 600,
        objective: "Map conversions so you see which keywords drive revenue",
      },
    ],
  },
  I03: {
    code: "I03",
    name: "LinkedIn Ads Integration",
    category: "Integration & Platform",
    basePrice: 1500,
    isTemplated: true,
    benefit: "so your LinkedIn campaigns connect to pipeline and revenue",
    parts: [
      {
        id: "I03-connection",
        name: "LinkedIn Ads connection",
        price: 900,
        objective: "Connect LinkedIn campaigns so B2B spend links to pipeline",
      },
      {
        id: "I03-mapping",
        name: "Lead sync & mapping",
        price: 600,
        objective: "Sync LinkedIn leads so campaigns tie to revenue",
      },
    ],
  },
  I04: {
    code: "I04",
    name: "Slack/Teams Integration",
    category: "Integration & Platform",
    basePrice: 1000,
    multiplier: 200,
    multiplierPer: "workspace",
    benefit: "so important notifications reach your team where they already work",
    parts: [
      {
        id: "I04-integration",
        name: "Workspace integration",
        price: 600,
        objective: "Connect Slack/Teams so notifications reach your team where they work",
      },
      {
        id: "I04-alerts",
        name: "Alert & channel config",
        price: 400,
        objective: "Configure the right alerts so important updates aren't missed",
      },
    ],
  },
  I05: {
    code: "I05",
    name: "Google Workspace Integration",
    category: "Integration & Platform",
    basePrice: 1500,
    isTemplated: true,
    benefit: "so your emails, calendar, and docs are connected to your business data",
    parts: [
      {
        id: "I05-connection",
        name: "Workspace connection",
        price: 900,
        objective: "Connect email, calendar and docs so your tools share business data",
      },
      {
        id: "I05-sync",
        name: "Sync & permissions setup",
        price: 600,
        objective: "Set up syncing and access so everything stays connected securely",
      },
    ],
  },
  I06: {
    code: "I06",
    name: "Custom API Integration",
    category: "Integration & Platform",
    basePrice: 3500,
    multiplier: 1000,
    multiplierPer: "endpoint",
    benefit: "so your unique tools connect to the rest of your system",
    parts: [
      {
        id: "I06-architecture",
        name: "Integration architecture & auth",
        price: 1900,
        objective: "Design the integration so your unique tools connect reliably and securely",
      },
      {
        id: "I06-endpoints",
        name: "Endpoint build & testing",
        price: 1600,
        objective: "Build and test each connection so data flows correctly",
      },
    ],
  },
  I07: {
    code: "I07",
    name: "Data Migration",
    category: "Integration & Platform",
    basePrice: 2000,
    multiplier: 500,
    multiplierPer: "5,000 records",
    benefit: "so your historical data comes with you and nothing is lost in the transition",
    parts: [
      {
        id: "I07-mapping",
        name: "Data mapping & cleanup",
        price: 1100,
        objective: "Map and clean your data so nothing is lost or duplicated in the move",
      },
      {
        id: "I07-validation",
        name: "Migration & validation",
        price: 900,
        objective: "Migrate and verify so your historical data comes across intact",
      },
    ],
  },
  I08: {
    code: "I08",
    name: "SSO Setup",
    category: "Integration & Platform",
    basePrice: 2000,
    benefit: "so your team has one login for everything and security is simplified",
    parts: [
      {
        id: "I08-integration",
        name: "SSO provider integration",
        price: 1200,
        objective: "Set up single sign-on so your team has one secure login for everything",
      },
      {
        id: "I08-policies",
        name: "Access policy configuration",
        price: 800,
        objective: "Configure access policies so security and onboarding are simplified",
      },
    ],
  },
};

// Build the parts array for a line item given the selected part IDs.
// If no selection is provided for the module, all parts are included by default.
function buildLineParts(
  moduleParts: ModulePart[] | undefined,
  selectedPartIds: string[] | undefined
): { parts: QuoteLinePart[] | undefined; includedTotal: number | null } {
  if (!moduleParts || moduleParts.length === 0) {
    return { parts: undefined, includedTotal: null };
  }
  const selected = selectedPartIds ?? moduleParts.map((p) => p.id);
  const parts: QuoteLinePart[] = moduleParts.map((p) => ({
    ...p,
    included: selected.includes(p.id),
  }));
  const includedTotal = parts
    .filter((p) => p.included)
    .reduce((sum, p) => sum + p.price, 0);
  return { parts, includedTotal };
}

// Helper function to calculate quote from unchecked items with module codes
export function calculateQuote(
  uncheckedModuleCodes: string[],
  quantities: Record<string, number> = {},
  discountPercent: number = 0,
  selectedParts: Record<string, string[]> = {}
): Quote {
  // Always include base modules first (foundation is always delivered in full)
  const baseLineItems: QuoteLineItem[] = Object.values(baseModules).map((module) => {
    const { parts } = buildLineParts(module.parts, undefined);
    return {
      code: module.code,
      module: module.name,
      quantity: 1,
      unitPrice: module.basePrice,
      lineTotal: module.basePrice,
      parts,
    };
  });

  // Deduplicate module codes
  const uniqueCodes = [...new Set(uncheckedModuleCodes)];

  const additionalLineItems: QuoteLineItem[] = uniqueCodes
    .filter((code) => modulePricing[code])
    .map((code) => {
      const module = modulePricing[code];
      const quantity = quantities[code] || 1;
      const { parts, includedTotal } = buildLineParts(
        module.parts,
        selectedParts[code]
      );
      const baseAmount = includedTotal ?? module.basePrice;
      const lineTotal = baseAmount + (module.multiplier || 0) * (quantity - 1);
      return {
        code,
        module: module.name,
        quantity,
        unitPrice: baseAmount,
        lineTotal,
        parts,
      };
    });

  const lineItems = [...baseLineItems, ...additionalLineItems];

  const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const discountAmount = Math.round(subtotal * (discountPercent / 100));
  const total = subtotal - discountAmount;
  const deposit = Math.round(total * 0.2);
  const balance = total - deposit;

  return {
    lineItems,
    subtotal,
    discountPercent,
    discountAmount,
    total,
    deposit,
    balance,
  };
}

// Helper to get module info by code
export function getModuleByCode(code: string): ModulePricing | undefined {
  return modulePricing[code];
}

// Get all modules grouped by category
export function getModulesByCategory(): Record<string, ModulePricing[]> {
  const grouped: Record<string, ModulePricing[]> = {};
  Object.values(modulePricing).forEach((module) => {
    if (!grouped[module.category]) {
      grouped[module.category] = [];
    }
    grouped[module.category].push(module);
  });
  return grouped;
}
