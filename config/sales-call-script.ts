import { z } from "zod";

// Schema for a single discovery question
export const discoveryQuestionSchema = z.object({
  id: z.string(),
  // The actual question to ask (conversational)
  askScript: z.string(),
  // What this question is checking for
  checksFor: z.string(),
  // The yes/no question for the checkbox
  yesNoQuestion: z.string(),
  // Statement to use in recap when they answer "No"
  noResponseRecap: z.string(),
  // Quantifying follow-up if they say no
  quantifyingQuestion: z.string().optional(),
  // Maps to checklist item IDs from the audit
  checklistItemIds: z.array(z.string()),
});

export type DiscoveryQuestion = z.infer<typeof discoveryQuestionSchema>;

// Schema for a script section (within discovery phase)
export const scriptSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  transitionScript: z.string(),
  questions: z.array(discoveryQuestionSchema),
  redFlags: z.array(z.string()),
});

export type ScriptSection = z.infer<typeof scriptSectionSchema>;

// Schema for a script phase
export const scriptPhaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  duration: z.string(),
  description: z.string(),
});

export type ScriptPhase = z.infer<typeof scriptPhaseSchema>;

// Define the 5 phases
export const scriptPhases: ScriptPhase[] = [
  {
    id: "opening",
    title: "Opening",
    duration: "2-3 min",
    description: "Build rapport, set the agenda, get permission to diagnose",
  },
  {
    id: "discovery",
    title: "Discovery & Audit",
    duration: "15-20 min",
    description: "Work through questions to identify pain points and gaps",
  },
  {
    id: "recap",
    title: "Recap Pain Points",
    duration: "2 min",
    description: "Summarize findings and confirm understanding",
  },
  {
    id: "solution",
    title: "Solution Demo",
    duration: "10-15 min",
    description: "Show relevant solutions based on identified gaps",
  },
  {
    id: "close",
    title: "Pricing & Close",
    duration: "5-10 min",
    description: "Present quote and handle objections",
  },
];

// Opening script content
export const openingScript = {
  greeting: "Hey, how's it going? Where are you calling from?",
  
  smallTalk: "[Wait for response, engage briefly with their answer]",
  
  agendaSetting: `Perfect. So before we dive in, let me tell you what I'd like to cover today. I want to understand how your business actually runs day-to-day - where leads come from, how you close deals, how you deliver to clients, all that stuff.

I'll ask some questions to identify where you might be losing time or money to inefficient processes. At the end, if it makes sense, I'll show you exactly how we'd fix it and what it would cost.

Sound fair?`,

  transitionToDiscovery: "Great. Let's start with the big picture...",
};

// Discovery sections with conversational questions
export const discoverySections: ScriptSection[] = [
  {
    id: "funnel-overview",
    title: "Revenue Funnel Overview",
    transitionScript: "Walk me through how a customer goes from not knowing you exist to actually paying you money. What does that journey look like?",
    questions: [
      {
        id: "lead-sources",
        askScript: "So where do most of your leads actually come from? Is it ads, referrals, content, cold outreach...?",
        checksFor: "Lead source tracking",
        yesNoQuestion: "Traffic sources are tracked and attributed",
        noResponseRecap: "You don't have complete attribution tracking for your lead sources",
        quantifyingQuestion: "Do you know which source brings the best leads?",
        checklistItemIds: ["funnel-traffic-tracked", "marketing-utm-tracking"],
      },
      {
        id: "cac-knowledge",
        askScript: "And do you know roughly how much you're spending to acquire each customer from those different channels?",
        checksFor: "CAC tracking",
        yesNoQuestion: "Customer Acquisition Cost is known per channel",
        noResponseRecap: "You don't know your customer acquisition cost per channel",
        quantifyingQuestion: "What's your estimated CAC right now?",
        checklistItemIds: ["funnel-cac-known"],
      },
      {
        id: "lead-capture",
        askScript: "When someone shows interest - fills out a form, replies to an email, whatever - what happens next? Where does that lead go?",
        checksFor: "Lead capture automation",
        yesNoQuestion: "Leads are automatically captured and added to CRM",
        noResponseRecap: "Leads aren't automatically captured and added to your CRM",
        quantifyingQuestion: "How many leads slip through the cracks each month?",
        checklistItemIds: ["funnel-lead-forms", "funnel-crm-auto"],
      },
      {
        id: "lead-followup",
        askScript: "How quickly do you typically follow up with new leads? What's that process look like?",
        checksFor: "Lead response time",
        yesNoQuestion: "Response time to new leads is under 5 minutes",
        noResponseRecap: "Lead response time could be faster - some leads may be cooling off",
        quantifyingQuestion: "What's your average response time right now?",
        checklistItemIds: ["funnel-response-time", "marketing-response-under-5min"],
      },
      {
        id: "lead-nurture",
        askScript: "What about leads that aren't ready to buy yet? Do you have a way to stay in touch with them automatically?",
        checksFor: "Lead nurturing",
        yesNoQuestion: "Automated email sequences nurture cold leads",
        noResponseRecap: "You don't have automated nurture sequences for cold leads",
        checklistItemIds: ["funnel-email-nurture", "marketing-nurture-automated"],
      },
      {
        id: "lead-scoring",
        askScript: "How do you decide which leads are worth your time versus which ones are just tire-kickers?",
        checksFor: "Lead prioritization",
        yesNoQuestion: "Lead scoring system determines priority",
        noResponseRecap: "You're treating all leads equally instead of prioritizing the best ones",
        checklistItemIds: ["funnel-lead-scoring"],
      },
    ],
    redFlags: [
      "\"We just respond when we can\"",
      "\"Leads go to my inbox\"",
      "\"We don't really track where leads come from\"",
      "\"We treat all leads the same\"",
    ],
  },
  {
    id: "sales-process",
    title: "Sales Process",
    transitionScript: "Okay, so once you have a qualified lead, walk me through what happens from first sales conversation to closed deal.",
    questions: [
      {
        id: "crm-usage",
        askScript: "What do you use to track your deals and pipeline? A CRM, spreadsheet, or...?",
        checksFor: "CRM adoption",
        yesNoQuestion: "CRM is used consistently by all salespeople",
        noResponseRecap: "CRM usage isn't consistent across the team - some deals may be getting missed",
        quantifyingQuestion: "How many deals are NOT in the system right now?",
        checklistItemIds: ["sales-crm-consistent"],
      },
      {
        id: "pipeline-stages",
        askScript: "Do you have clearly defined stages that deals move through? Like, everyone knows when a deal moves from 'qualified' to 'proposal sent'?",
        checksFor: "Pipeline definition",
        yesNoQuestion: "Pipeline stages are clearly defined with exit criteria",
        noResponseRecap: "Pipeline stages could be more clearly defined - it's hard to know where deals stand",
        checklistItemIds: ["funnel-sales-stages", "sales-stages-defined"],
      },
      {
        id: "sales-cycle",
        askScript: "How long does it typically take to close a deal from first call to signed contract? Is that too long?",
        checksFor: "Sales velocity",
        yesNoQuestion: "Sales cycle length is tracked and optimized",
        noResponseRecap: "Sales cycle length isn't being tracked - deals may be taking longer than needed",
        quantifyingQuestion: "What's your average sales cycle in days?",
        checklistItemIds: ["sales-values-tracked"],
      },
      {
        id: "proposal-process",
        askScript: "When you need to send a proposal, what does that process look like? How long does it take?",
        checksFor: "Proposal efficiency",
        yesNoQuestion: "Proposals and quotes are templated or automated",
        noResponseRecap: "Proposals are created from scratch each time - this takes extra time per deal",
        quantifyingQuestion: "How many hours do you spend on proposals per month?",
        checklistItemIds: ["funnel-proposals-templated", "sales-proposals-automated"],
      },
      {
        id: "contract-process",
        askScript: "And once they say yes, how do you handle contracts? Still doing email back-and-forth with PDFs?",
        checksFor: "Contract automation",
        yesNoQuestion: "E-signature is implemented with streamlined contracts",
        noResponseRecap: "Contract process is still manual - deals can slow down waiting for signatures",
        checklistItemIds: ["funnel-contracts-streamlined", "sales-esignature"],
      },
      {
        id: "win-loss",
        askScript: "Do you track why you win or lose deals? Like, do you know the top 3 reasons people say no?",
        checksFor: "Win/loss analysis",
        yesNoQuestion: "Win/loss reasons are tracked and analyzed",
        noResponseRecap: "Win/loss reasons aren't being tracked - harder to improve without this data",
        checklistItemIds: ["funnel-win-loss-tracked", "sales-win-rates-known"],
      },
      {
        id: "sales-admin",
        askScript: "How much time would you say your sales team spends on admin stuff versus actually selling?",
        checksFor: "Sales productivity",
        yesNoQuestion: "Sales activity is logged automatically",
        noResponseRecap: "Sales team spends time on admin tasks that could be automated",
        quantifyingQuestion: "What percentage of time is admin vs selling?",
        checklistItemIds: ["sales-activity-logged", "sales-followup-automated"],
      },
    ],
    redFlags: [
      "\"Our CRM is kind of a graveyard\"",
      "\"Proposals take a few days to put together\"",
      "\"We don't really track why we lose deals\"",
      "\"Contracts require multiple email threads\"",
    ],
  },
  {
    id: "delivery",
    title: "Delivery & Fulfillment",
    transitionScript: "Great. Now let's talk about what happens after the deal closes. Walk me through the handoff from sales to whoever delivers the work.",
    questions: [
      {
        id: "handoff",
        askScript: "When a deal closes, how does the delivery team find out? What information gets passed along?",
        checksFor: "Sales-to-delivery handoff",
        yesNoQuestion: "Closed deals automatically trigger delivery with full context",
        noResponseRecap: "Sales-to-delivery handoff could be smoother - some info gets lost in the transition",
        quantifyingQuestion: "How often is info missing or wrong in handoffs?",
        checklistItemIds: ["funnel-handoff-smooth", "sales-triggers-fulfillment", "delivery-info-transfer"],
      },
      {
        id: "onboarding",
        askScript: "Do you have a standard onboarding process? Like, is it the same steps every time or does it vary by person?",
        checksFor: "Onboarding standardization",
        yesNoQuestion: "Onboarding process is documented and consistent",
        noResponseRecap: "Onboarding process isn't fully standardized - experience can vary",
        checklistItemIds: ["funnel-onboarding-documented", "delivery-onboarding-checklist"],
      },
      {
        id: "project-tracking",
        askScript: "Where do you track projects or orders? Does everything live in one system or is it scattered around?",
        checksFor: "Project centralization",
        yesNoQuestion: "All projects are tracked in one system",
        noResponseRecap: "Projects are tracked in multiple places - no single source of truth yet",
        quantifyingQuestion: "How many different places do you have to check for status?",
        checklistItemIds: ["funnel-project-tracking", "delivery-single-system"],
      },
      {
        id: "client-visibility",
        askScript: "How do clients know what's happening with their project? Do they have to ask you, or can they see status themselves?",
        checksFor: "Client visibility",
        yesNoQuestion: "Clients have self-service visibility via portal or updates",
        noResponseRecap: "Clients don't have self-service visibility - they have to ask for status updates",
        quantifyingQuestion: "How many 'where are we at?' emails do you get per week?",
        checklistItemIds: ["funnel-client-comms", "delivery-client-portal", "delivery-status-automated"],
      },
      {
        id: "scope-changes",
        askScript: "What happens when scope changes mid-project? How do you document and handle that?",
        checksFor: "Scope management",
        yesNoQuestion: "Scope changes are documented and require approval",
        noResponseRecap: "Scope changes aren't formally documented - can lead to budget surprises",
        checklistItemIds: ["delivery-scope-documented"],
      },
      {
        id: "quality",
        askScript: "Before you deliver to a client, is there a QA step or approval process?",
        checksFor: "Quality assurance",
        yesNoQuestion: "Quality checkpoints exist before delivery",
        noResponseRecap: "No formal quality checkpoints before delivery - issues may slip through",
        checklistItemIds: ["delivery-quality-checkpoints", "delivery-signoff-defined"],
      },
    ],
    redFlags: [
      "\"Sales makes promises delivery doesn't know about\"",
      "\"We re-gather client info after the sale\"",
      "\"Projects are tracked in spreadsheets and emails\"",
      "\"Clients constantly ask 'where are we at?'\"",
    ],
  },
  {
    id: "customer-success",
    title: "Customer Success & Retention",
    transitionScript: "Now let's talk about after delivery. How do you keep customers happy and coming back?",
    questions: [
      {
        id: "health-tracking",
        askScript: "How do you know if a customer is happy or at risk of leaving? Is there a way to see that proactively?",
        checksFor: "Customer health monitoring",
        yesNoQuestion: "Customer health scores are tracked",
        noResponseRecap: "No proactive way to identify at-risk customers before they leave",
        quantifyingQuestion: "When was the last time a churn surprised you?",
        checklistItemIds: ["funnel-health-monitored", "success-health-scores", "success-at-risk-flagged"],
      },
      {
        id: "feedback",
        askScript: "Do you collect feedback systematically? Like NPS surveys or satisfaction scores?",
        checksFor: "Customer feedback",
        yesNoQuestion: "NPS or CSAT surveys are automated",
        noResponseRecap: "You're not systematically collecting customer feedback",
        checklistItemIds: ["success-nps-csat", "success-testimonials"],
      },
      {
        id: "renewals",
        askScript: "For recurring revenue or repeat business, how do you handle renewals? Is someone proactively reaching out?",
        checksFor: "Renewal management",
        yesNoQuestion: "Renewal outreach starts 60-90 days before expiration",
        noResponseRecap: "Renewal outreach is reactive - you're waiting until contracts expire",
        quantifyingQuestion: "What's your renewal or repeat business rate?",
        checklistItemIds: ["funnel-renewal-proactive", "success-renewal-tracked", "success-renewal-outreach"],
      },
      {
        id: "upsell",
        askScript: "How do you identify opportunities to upsell or cross-sell to existing customers?",
        checksFor: "Expansion revenue",
        yesNoQuestion: "Upsell triggers and playbooks exist",
        noResponseRecap: "No systematic way to identify upsell opportunities with existing customers",
        checklistItemIds: ["funnel-upsell-triggers", "success-upsell-playbooks"],
      },
      {
        id: "referrals",
        askScript: "What about referrals? Do you have a structured way to ask for and track referrals?",
        checksFor: "Referral program",
        yesNoQuestion: "Referral program with incentives is in place",
        noResponseRecap: "No structured referral program in place - could be a source of new business",
        checklistItemIds: ["funnel-referral-system", "success-referral-incentives"],
      },
    ],
    redFlags: [
      "\"Customers churn and we didn't see it coming\"",
      "\"Renewals are reactive - we reach out at expiration\"",
      "\"We ask for referrals when we remember\"",
    ],
  },
  {
    id: "finance",
    title: "Finance & Admin",
    transitionScript: "Let's talk about the money side. How long does it take to go from completed work to actually getting paid?",
    questions: [
      {
        id: "invoicing",
        askScript: "How do you create and send invoices? Is it manual or does it happen automatically when work is done?",
        checksFor: "Invoice automation",
        yesNoQuestion: "Invoices are auto-generated from deals or projects",
        noResponseRecap: "Invoices are created manually - takes extra time and can delay payment",
        quantifyingQuestion: "How many hours per month on invoicing?",
        checklistItemIds: ["funnel-payment-automated", "finance-invoices-auto", "delivery-invoicing-trigger"],
      },
      {
        id: "payment-collection",
        askScript: "Can clients pay online, or are you still dealing with checks and bank transfers?",
        checksFor: "Payment methods",
        yesNoQuestion: "Online payment is enabled",
        noResponseRecap: "No online payment option yet - clients have fewer ways to pay",
        checklistItemIds: ["finance-online-payment"],
      },
      {
        id: "payment-reminders",
        askScript: "When invoices go unpaid, what happens? Is someone manually chasing payments?",
        checksFor: "Collections automation",
        yesNoQuestion: "Payment reminders are automated",
        noResponseRecap: "Payment reminders are manual - invoices may stay unpaid longer",
        quantifyingQuestion: "What's your average days to get paid?",
        checklistItemIds: ["finance-reminders-auto"],
      },
      {
        id: "profitability",
        askScript: "Do you know which clients or projects are actually profitable? Can you see that in real-time or do you find out later?",
        checksFor: "Profitability visibility",
        yesNoQuestion: "Profit margins are visible per client/project",
        noResponseRecap: "Profitability per client or project isn't visible in real-time",
        quantifyingQuestion: "Have you ever finished a project and realized you lost money?",
        checklistItemIds: ["finance-margins-visible", "finance-expenses-tracked"],
      },
      {
        id: "accounting",
        askScript: "What does month-end close look like? How many hours does it take?",
        checksFor: "Accounting efficiency",
        yesNoQuestion: "Accounting system is integrated with operations",
        noResponseRecap: "Accounting isn't fully integrated - month-end close takes longer than it could",
        quantifyingQuestion: "Hours spent on month-end close?",
        checklistItemIds: ["finance-revenue-recognized", "finance-reports-automated"],
      },
    ],
    redFlags: [
      "\"Invoices are created manually in Excel/Word\"",
      "\"We chase payments via email\"",
      "\"We find out if a project was profitable after it's done\"",
      "\"Month-end takes days of reconciliation\"",
    ],
  },
  {
    id: "tech-stack",
    title: "Tech Stack & Integrations",
    transitionScript: "Last section. Let's talk about your tools. What software does your team use day-to-day?",
    questions: [
      {
        id: "tool-count",
        askScript: "Roughly how many different software tools does your team use? And do they talk to each other?",
        checksFor: "Tool integration",
        yesNoQuestion: "Tools are integrated with single source of truth",
        noResponseRecap: "Tools aren't fully integrated - data lives in separate places",
        quantifyingQuestion: "How many tools total? How many are integrated?",
        checklistItemIds: ["tech-crm-email", "tech-marketing-crm", "tech-pm-crm"],
      },
      {
        id: "manual-data",
        askScript: "Where are you manually moving data between systems? Like exporting from one tool and importing to another?",
        checksFor: "Data automation",
        yesNoQuestion: "No manual data movement between systems",
        noResponseRecap: "Data is being moved manually between systems - takes extra time each week",
        quantifyingQuestion: "Hours per week on manual data entry?",
        checklistItemIds: ["tech-invoicing-projects", "tech-payments-accounting"],
      },
      {
        id: "reporting",
        askScript: "When you need to see the big picture - like revenue, pipeline, delivery status - can you see that in one place or do you have to pull from multiple tools?",
        checksFor: "Unified reporting",
        yesNoQuestion: "Reporting consolidates data from all tools",
        noResponseRecap: "No unified reporting yet - need to pull from multiple tools to see the big picture",
        checklistItemIds: ["tech-reporting-consolidated"],
      },
    ],
    redFlags: [
      "\"10+ tools with no integration\"",
      "\"Same data entered in multiple systems\"",
      "\"Zapier integrations constantly break\"",
      "\"No single source of truth\"",
    ],
  },
];

// Recap phase content
export const recapScript = {
  intro: "Okay, let me make sure I've got this right. Based on what you've told me, your biggest operational gaps are:",
  
  painPointTemplate: "[Pain Point]: You mentioned [specific issue]. This is causing [impact].",
  
  confirmation: "Did I capture that correctly? Anything I missed?",
  
  quantifyTransition: "If I had to estimate, it sounds like these issues are costing you roughly [X] hours per week. At even a modest hourly rate, that's [Y] per year in lost productivity - not counting the deals you're losing to slow follow-up and the clients churning because of poor visibility.",
  
  solutionTransition: "Here's the good news - everything we just talked about is fixable. Let me show you exactly how we'd solve each of these...",
};

// Solution demo content
export const solutionScript = {
  intro: "So based on what we discussed, here are the specific modules that would solve your problems:",
  
  moduleTemplate: `For [pain point], we'd implement [module name]. 

Here's how it works: [brief demo/explanation]

We did this for [similar company]. They went from [before state] to [after state].

Can you see this working for your team?`,
  
  transitionToPrice: "Those are the key pieces. Ready to see what the investment looks like?",
};

// Closing phase content
export const closeScript = {
  priceIntro: "Based on what we discussed, here's what it would take to solve your pain points...",
  
  walkThrough: "[Walk through quote line by line, briefly explaining each module]",
  
  closeStatement: `Your total investment is $[X]. We start with a 20% deposit of $[Y], and the balance is due when we go live. 

You said this problem costs you $[Z] per year - so this pays for itself in [timeframe].

How's Monday to get started?`,
};

// Objection handlers
export const objectionHandlers: Record<string, { objection: string; response: string }> = {
  "think-about-it": {
    objection: "I need to think about it",
    response: "Totally fair. What specifically do you need to think through? Is it the investment, the timing, or whether it'll actually work for your situation?",
  },
  "too-expensive": {
    objection: "It's too expensive",
    response: "I hear you - it's a real investment. Help me understand: is it the total amount, or is it more about cash flow and timing? [Pause for answer] You mentioned this problem costs you roughly $[X] per year. This is a one-time investment that typically pays for itself in [Y months]. So really, the question is: can you afford to keep paying that inefficiency tax while you wait?",
  },
  "partner": {
    objection: "I need to talk to my partner/team",
    response: "Of course. What questions do you think they'll have? Let's address those now so you can present it confidently. Or, can we get them on a quick call?",
  },
  "not-ready": {
    objection: "We're not ready yet",
    response: "When would you be ready? And what needs to happen between now and then? [Pause] Every month you wait, you're paying that $[X] inefficiency tax.",
  },
  "discount": {
    objection: "Can you do it for less?",
    response: "Which modules would you want to remove? I can reduce scope, but I'd hate for you to solve only half the problem. What's your budget? Let's see what we can prioritize.",
  },
};

// Helper to get all checklist item IDs from questions
export function getAllChecklistItemIds(): string[] {
  const ids: string[] = [];
  discoverySections.forEach((section) => {
    section.questions.forEach((question) => {
      ids.push(...question.checklistItemIds);
    });
  });
  return [...new Set(ids)];
}
