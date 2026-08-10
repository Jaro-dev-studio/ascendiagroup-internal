import { z } from "zod";

// Schema for a single checklist item
export const checklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  improvement: z.string(),
  impact: z.string(),
  moduleCodes: z.array(z.string()).optional(), // Maps to pricing modules (e.g., ["M01", "M06"])
});

// Schema for a single audit section
export const auditSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  discoveryQuestions: z.array(z.string()),
  checklistItems: z.array(checklistItemSchema),
  redFlags: z.array(z.string()),
});

// Schema for the entire audit configuration
export const salesAuditConfigSchema = z.object({
  sections: z.array(auditSectionSchema),
});

// Type exports
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type AuditSection = z.infer<typeof auditSectionSchema>;
export type SalesAuditConfig = z.infer<typeof salesAuditConfigSchema>;

// Schema for stored audit data (what gets saved to DB)
export const auditDataSchema = z.object({
  sections: z.record(
    z.string(),
    z.object({
      checkedItems: z.array(z.string()),
      notes: z.string().optional(),
    })
  ),
  keyFindings: z.array(z.string()).optional(),
  estimatedHoursLostPerWeek: z.number().optional(),
  recommendedNextSteps: z.array(z.string()).optional(),
});

export type AuditData = z.infer<typeof auditDataSchema>;

// The actual audit configuration based on the Operations Audit SOP
export const salesAuditConfig: SalesAuditConfig = {
  sections: [
    // Section 1: Revenue Funnel Map
    {
      id: "revenue-funnel",
      title: "Revenue Funnel Map",
      description:
        "Map the entire customer journey from first touch to revenue. This reveals where value is created and where it leaks.",
      discoveryQuestions: [
        "Walk me through how a customer goes from not knowing you exist to paying you money.",
        "What's your primary source of new leads/customers?",
        "How many touches does it typically take to close a deal?",
        "Where do you lose the most potential customers in this journey?",
      ],
      checklistItems: [
        // Awareness Stage
        {
          id: "funnel-traffic-tracked",
          label: "Traffic sources are tracked and attributed",
          improvement:
            "Implement UTM tracking and analytics to attribute traffic sources",
          impact: "Know which channels drive actual revenue, optimize ad spend by 20-30%",
        },
        {
          id: "funnel-content-measured",
          label: "Content/ads performance is measured",
          improvement: "Set up conversion tracking for all marketing content",
          impact: "Identify top-performing content, increase lead quality by 25%",
        },
        {
          id: "funnel-cac-known",
          label: "CAC (Customer Acquisition Cost) is known per channel",
          improvement: "Calculate and track CAC by marketing channel",
          impact: "Optimize marketing budget allocation, reduce CAC by 15-25%",
        },
        {
          id: "funnel-lead-magnets",
          label: "Lead magnets/entry points are documented",
          improvement: "Document and optimize lead capture entry points",
          impact: "Increase lead capture rate by 30-50%",
        },
        // Interest/Consideration Stage
        {
          id: "funnel-lead-forms",
          label: "Lead capture forms exist with proper fields",
          improvement: "Create optimized lead capture forms with essential fields only",
          impact: "Increase form completion rate by 20-40%",
        },
        {
          id: "funnel-crm-auto",
          label: "Leads are automatically added to CRM",
          improvement: "Automate lead import from all sources to CRM",
          impact: "Save 5-10 hours/week on manual data entry, prevent lead loss",
        },
        {
          id: "funnel-email-nurture",
          label: "Email sequences nurture cold leads",
          improvement: "Create automated email nurture sequences",
          impact: "Convert 10-15% more leads through consistent follow-up",
        },
        {
          id: "funnel-lead-scoring",
          label: "Lead scoring system exists",
          improvement: "Implement lead scoring based on engagement and fit",
          impact: "Focus sales time on high-value leads, increase close rate by 20%",
        },
        {
          id: "funnel-response-time",
          label: "Response time to inquiries is tracked",
          improvement: "Track and optimize lead response time",
          impact: "Responding in <5 min increases conversion by 9x",
        },
        // Decision/Purchase Stage
        {
          id: "funnel-sales-stages",
          label: "Sales process stages are clearly defined",
          improvement: "Document clear sales stages with exit criteria",
          impact: "Improve forecast accuracy by 40%, identify bottlenecks",
        },
        {
          id: "funnel-proposals-templated",
          label: "Proposals/quotes are templated",
          improvement: "Create proposal templates for common scenarios",
          impact: "Save 2-5 hours per proposal, maintain consistency",
        },
        {
          id: "funnel-contracts-streamlined",
          label: "Contract/agreement process is streamlined",
          improvement: "Implement e-signature and contract automation",
          impact: "Reduce close time by 3-5 days, improve close rate",
        },
        {
          id: "funnel-payment-automated",
          label: "Payment collection is automated",
          improvement: "Set up automated invoicing and payment collection",
          impact: "Reduce DSO by 10-15 days, save 5+ hours/week",
        },
        {
          id: "funnel-win-loss-tracked",
          label: "Win/loss reasons are tracked",
          improvement: "Track and analyze reasons for won and lost deals",
          impact: "Address objections proactively, increase win rate by 15%",
        },
        // Delivery/Fulfillment Stage
        {
          id: "funnel-onboarding-documented",
          label: "Onboarding process is documented",
          improvement: "Create standardized onboarding process",
          impact: "Reduce time-to-value by 50%, improve retention",
        },
        {
          id: "funnel-handoff-smooth",
          label: "Handoff from sales to delivery is smooth",
          improvement: "Automate sales-to-delivery handoff with all context",
          impact: "Eliminate re-gathering info, save 2-3 hours per client",
        },
        {
          id: "funnel-project-tracking",
          label: "Project/order tracking exists",
          improvement: "Implement project management with status tracking",
          impact: "Improve visibility, reduce client check-ins by 70%",
        },
        {
          id: "funnel-client-comms",
          label: "Client communication is centralized",
          improvement: "Centralize all client communications in one system",
          impact: "Never miss client messages, improve response time by 50%",
        },
        // Retention/Expansion Stage
        {
          id: "funnel-health-monitored",
          label: "Customer health is monitored",
          improvement: "Implement customer health scoring",
          impact: "Identify at-risk customers early, reduce churn by 20-30%",
        },
        {
          id: "funnel-renewal-proactive",
          label: "Renewal process is proactive",
          improvement: "Set up proactive renewal outreach 60-90 days early",
          impact: "Increase renewal rate by 15-25%",
        },
        {
          id: "funnel-upsell-triggers",
          label: "Upsell/cross-sell triggers exist",
          improvement: "Define and automate expansion opportunity triggers",
          impact: "Increase revenue per customer by 20-30%",
        },
        {
          id: "funnel-referral-system",
          label: "Referral system is in place",
          improvement: "Implement structured referral program",
          impact: "Generate 10-20% of new business from referrals",
        },
      ],
      redFlags: [
        "No clear funnel stages defined — \"we just wing it\"",
        "Different tools for each stage with no integration",
        "No visibility into conversion rates between stages",
        "Manual data entry to move leads between systems",
        "No idea which marketing channels actually drive revenue",
      ],
    },

    // Section 2: Lead Generation & Marketing Ops
    {
      id: "marketing-ops",
      title: "Lead Generation & Marketing Ops",
      description:
        "Evaluate how they generate demand and manage marketing operations.",
      discoveryQuestions: [
        "How do you track which marketing efforts generate actual revenue?",
        "What happens when a new lead comes in? Walk me through the first 24 hours.",
        "How do you decide which leads are worth pursuing?",
        "What's your biggest marketing bottleneck right now?",
      ],
      checklistItems: [
        {
          id: "marketing-utm-tracking",
          label: "Lead sources are tracked with UTM parameters",
          improvement: "Implement UTM tracking across all marketing channels",
          impact: "Attribute revenue to marketing efforts, optimize spend",
        },
        {
          id: "marketing-handoff-criteria",
          label: "Marketing-to-sales handoff criteria defined",
          improvement: "Define MQL criteria and automate handoff",
          impact: "Improve lead quality to sales by 30%, reduce friction",
        },
        {
          id: "marketing-email-crm",
          label: "Email marketing platform integrated with CRM",
          improvement: "Integrate email marketing with CRM bidirectionally",
          impact: "Unified view of customer journey, personalized outreach",
        },
        {
          id: "marketing-landing-pages",
          label: "Landing pages can be created without dev help",
          improvement: "Implement no-code landing page builder",
          impact: "Launch campaigns 5x faster, reduce dev dependency",
        },
        {
          id: "marketing-ab-testing",
          label: "A/B testing is performed regularly",
          improvement: "Set up A/B testing framework for campaigns",
          impact: "Continuously improve conversion rates by 10-20%",
        },
        {
          id: "marketing-dashboard",
          label: "Marketing reporting dashboard exists",
          improvement: "Create automated marketing performance dashboard",
          impact: "Save 5+ hours/week on reporting, faster decisions",
        },
        {
          id: "marketing-content-calendar",
          label: "Content calendar is maintained",
          improvement: "Implement content planning and scheduling system",
          impact: "Consistent content output, never miss deadlines",
        },
        {
          id: "marketing-social-centralized",
          label: "Social media management is centralized",
          improvement: "Centralize social media in one management tool",
          impact: "Save 3-5 hours/week, maintain consistent presence",
        },
        {
          id: "marketing-response-under-5min",
          label: "Lead response time is under 5 minutes",
          improvement: "Implement instant lead notification and routing",
          impact: "9x higher contact rate, 21x higher qualification rate",
        },
        {
          id: "marketing-nurture-automated",
          label: "Automated lead nurture sequences exist",
          improvement: "Create automated drip campaigns for different segments",
          impact: "Convert 47% more leads through nurturing",
        },
      ],
      redFlags: [
        "Leads sit in a spreadsheet or inbox for hours/days",
        "No lead scoring — all leads treated equally",
        "Marketing and sales use different definitions of \"qualified\"",
        "Can't attribute closed revenue to marketing campaigns",
        "Manual export/import between marketing tools and CRM",
      ],
    },

    // Section 3: Sales Operations
    {
      id: "sales-ops",
      title: "Sales Operations",
      description:
        "Assess how efficiently they convert opportunities to closed revenue.",
      discoveryQuestions: [
        "What does your sales process look like from first call to closed deal?",
        "How long is your average sales cycle? Is that too long?",
        "What percentage of deals do you win? What causes you to lose?",
        "How much time do your salespeople spend on admin vs. actual selling?",
        "How do you forecast revenue for next month/quarter?",
      ],
      checklistItems: [
        // CRM & Pipeline Management
        {
          id: "sales-crm-consistent",
          label: "CRM is used consistently by all salespeople",
          improvement: "Enforce CRM usage with automation and accountability",
          impact: "Complete pipeline visibility, accurate forecasting",
        },
        {
          id: "sales-stages-defined",
          label: "Pipeline stages are clearly defined with exit criteria",
          improvement: "Document stage definitions and exit criteria",
          impact: "Improve forecast accuracy by 40%, identify bottlenecks",
        },
        {
          id: "sales-values-tracked",
          label: "Deal values and close dates are tracked",
          improvement: "Require deal values and expected close dates",
          impact: "Enable accurate revenue forecasting",
        },
        {
          id: "sales-pipeline-reviewed",
          label: "Pipeline is reviewed weekly/daily",
          improvement: "Implement regular pipeline review cadence",
          impact: "Keep deals moving, improve velocity by 20%",
        },
        {
          id: "sales-win-rates-known",
          label: "Historical win rates are known by stage",
          improvement: "Track and analyze win rates by pipeline stage",
          impact: "Optimize sales process, improve close rate by 15%",
        },
        // Sales Productivity
        {
          id: "sales-email-templates",
          label: "Sales email templates exist and are used",
          improvement: "Create and enforce email template library",
          impact: "Save 5-10 hours/week per rep, improve consistency",
        },
        {
          id: "sales-proposals-automated",
          label: "Proposal/quote generation is templated or automated",
          improvement: "Implement proposal automation with templates",
          impact: "Reduce proposal time by 80%, close faster",
        },
        {
          id: "sales-scheduling-self-service",
          label: "Meeting scheduling is self-service (Calendly, etc.)",
          improvement: "Implement self-service scheduling",
          impact: "Eliminate scheduling back-and-forth, save 2+ hours/week",
        },
        {
          id: "sales-activity-logged",
          label: "Sales activity is logged automatically (calls, emails)",
          improvement: "Automate activity logging with CRM integrations",
          impact: "Save 5+ hours/week on manual logging",
        },
        {
          id: "sales-followup-automated",
          label: "Follow-up tasks are automated or queued",
          improvement: "Automate follow-up task creation and reminders",
          impact: "Never miss a follow-up, improve close rate",
        },
        // Contracting & Closing
        {
          id: "sales-contracts-standardized",
          label: "Contract templates are standardized",
          improvement: "Create standardized contract templates",
          impact: "Reduce legal review time, close 3-5 days faster",
        },
        {
          id: "sales-esignature",
          label: "E-signature is implemented",
          improvement: "Implement e-signature solution",
          impact: "Close deals 80% faster than paper contracts",
        },
        {
          id: "sales-payment-terms",
          label: "Payment terms are clear and enforced",
          improvement: "Standardize and automate payment terms",
          impact: "Reduce payment delays, improve cash flow",
        },
        {
          id: "sales-triggers-fulfillment",
          label: "Closed deals automatically trigger fulfillment",
          improvement: "Automate handoff from closed deal to delivery",
          impact: "Eliminate delays, improve customer experience",
        },
      ],
      redFlags: [
        "CRM is a graveyard — data is stale or incomplete",
        "Salespeople create proposals from scratch each time",
        "No visibility into why deals are won or lost",
        "Forecasting is done in spreadsheets or \"gut feel\"",
        "Contracts require multiple email threads to finalize",
        "Handoff to delivery is verbal or via email",
      ],
    },

    // Section 4: Fulfillment & Delivery Operations
    {
      id: "delivery-ops",
      title: "Fulfillment & Delivery Operations",
      description:
        "Evaluate how they deliver value after the sale is closed.",
      discoveryQuestions: [
        "What happens the moment a deal closes? Who does what?",
        "How do you track project/order status and progress?",
        "What causes delays in delivery? What goes wrong most often?",
        "How do clients know what's happening with their project/order?",
        "How do you know if a project is profitable before it's done?",
      ],
      checklistItems: [
        // Onboarding & Kickoff
        {
          id: "delivery-onboarding-checklist",
          label: "Onboarding checklist/process exists",
          improvement: "Create standardized onboarding checklist",
          impact: "Reduce onboarding time by 50%, consistent experience",
        },
        {
          id: "delivery-info-transfer",
          label: "Client information transfers from sales to delivery",
          improvement: "Automate info transfer from CRM to project system",
          impact: "Eliminate re-gathering info, save 2-3 hours per client",
        },
        {
          id: "delivery-kickoff-template",
          label: "Kickoff meeting template/agenda exists",
          improvement: "Create kickoff meeting template",
          impact: "Professional first impression, clear expectations",
        },
        {
          id: "delivery-client-portal",
          label: "Client portal or project space is provisioned",
          improvement: "Implement client portal with self-service access",
          impact: "Reduce status inquiries by 70%",
        },
        {
          id: "delivery-timeline-shared",
          label: "Timeline and milestones are set and shared",
          improvement: "Create milestone templates and share with clients",
          impact: "Clear expectations, fewer scope discussions",
        },
        // Project/Order Management
        {
          id: "delivery-single-system",
          label: "All projects/orders are tracked in one system",
          improvement: "Consolidate project tracking in one system",
          impact: "Complete visibility, no projects falling through cracks",
        },
        {
          id: "delivery-tasks-clear",
          label: "Task assignments and deadlines are clear",
          improvement: "Implement task management with clear ownership",
          impact: "Improve on-time delivery by 30%",
        },
        {
          id: "delivery-time-tracking",
          label: "Time tracking exists (if applicable)",
          improvement: "Implement time tracking for billable work",
          impact: "Accurate billing, profitability visibility",
        },
        {
          id: "delivery-status-automated",
          label: "Status updates are automated or scheduled",
          improvement: "Automate status update notifications",
          impact: "Reduce client check-ins, save 5+ hours/week",
        },
        {
          id: "delivery-scope-documented",
          label: "Scope changes are documented and approved",
          improvement: "Implement change request workflow",
          impact: "Prevent scope creep, protect margins",
        },
        {
          id: "delivery-dependencies",
          label: "Dependencies between tasks are mapped",
          improvement: "Map task dependencies in project management",
          impact: "Identify blockers early, improve delivery time",
        },
        // Quality & Completion
        {
          id: "delivery-quality-checkpoints",
          label: "Quality checkpoints exist before delivery",
          improvement: "Implement QA checkpoints in delivery process",
          impact: "Reduce rework by 40%, improve satisfaction",
        },
        {
          id: "delivery-signoff-defined",
          label: "Client sign-off process is defined",
          improvement: "Create formal sign-off workflow",
          impact: "Clear completion criteria, faster project close",
        },
        {
          id: "delivery-retrospectives",
          label: "Project retrospectives/reviews happen",
          improvement: "Implement project retrospective process",
          impact: "Continuous improvement, team learning",
        },
        {
          id: "delivery-invoicing-trigger",
          label: "Delivery triggers invoicing automatically",
          improvement: "Automate invoicing upon project completion",
          impact: "Reduce billing delays, improve cash flow",
        },
      ],
      redFlags: [
        "Sales makes promises delivery doesn't know about",
        "Client info is re-gathered after the sale",
        "Projects tracked in spreadsheets, email, or heads",
        "No idea if a project is profitable until it's over",
        "Clients constantly ask \"where are we at?\"",
        "Scope creep happens with no documentation",
      ],
    },

    // Section 5: Customer Success & Retention
    {
      id: "customer-success",
      title: "Customer Success & Retention",
      description:
        "Assess how they maximize customer lifetime value and reduce churn.",
      discoveryQuestions: [
        "How do you know if a customer is happy or at risk of leaving?",
        "What's your customer churn rate? Do you know why customers leave?",
        "How do you identify upsell or expansion opportunities?",
        "Do you have a referral program or process?",
      ],
      checklistItems: [
        // Health Monitoring
        {
          id: "success-health-scores",
          label: "Customer health scores are tracked",
          improvement: "Implement customer health scoring system",
          impact: "Identify at-risk customers early, reduce churn by 25%",
        },
        {
          id: "success-usage-monitored",
          label: "Usage/engagement data is monitored",
          improvement: "Track product usage and engagement metrics",
          impact: "Proactive outreach to disengaged customers",
        },
        {
          id: "success-nps-csat",
          label: "NPS or CSAT surveys are conducted",
          improvement: "Implement regular customer satisfaction surveys",
          impact: "Early warning system, improve satisfaction scores",
        },
        {
          id: "success-at-risk-flagged",
          label: "At-risk customers are flagged early",
          improvement: "Create automated at-risk customer alerts",
          impact: "Intervene before churn, save 20-30% of at-risk accounts",
        },
        {
          id: "success-check-ins",
          label: "Regular check-ins are scheduled",
          improvement: "Implement proactive customer check-in cadence",
          impact: "Build relationships, identify issues early",
        },
        // Renewals & Expansion
        {
          id: "success-renewal-tracked",
          label: "Renewal dates are tracked in advance",
          improvement: "Track all renewal dates with automated reminders",
          impact: "Never miss a renewal, improve retention by 15%",
        },
        {
          id: "success-renewal-outreach",
          label: "Renewal outreach starts 60-90 days early",
          improvement: "Automate early renewal outreach sequence",
          impact: "Higher renewal rates, more time to address issues",
        },
        {
          id: "success-upsell-playbooks",
          label: "Upsell playbooks or triggers exist",
          improvement: "Create upsell triggers based on usage/engagement",
          impact: "Increase revenue per customer by 20-30%",
        },
        {
          id: "success-account-plans",
          label: "Account plans exist for key customers",
          improvement: "Develop strategic account plans for top clients",
          impact: "Deeper relationships, 40% higher retention",
        },
        // Advocacy & Referrals
        {
          id: "success-case-studies",
          label: "Case studies are regularly created",
          improvement: "Systematize case study creation process",
          impact: "Powerful sales assets, shorten sales cycle",
        },
        {
          id: "success-testimonials",
          label: "Review/testimonial process exists",
          improvement: "Automate testimonial and review requests",
          impact: "Build social proof, improve conversion",
        },
        {
          id: "success-referral-incentives",
          label: "Referral incentives are offered",
          improvement: "Implement referral program with incentives",
          impact: "Generate 10-20% of new business from referrals",
        },
        {
          id: "success-community",
          label: "Customer community or events exist",
          improvement: "Build customer community for engagement",
          impact: "Increase retention, reduce support load",
        },
      ],
      redFlags: [
        "Customers churn and no one saw it coming",
        "Renewals are reactive — reached out at expiration",
        "No idea which customers are expansion opportunities",
        "Customer feedback is scattered across inboxes",
        "\"We'll ask for a referral when we remember\"",
      ],
    },

    // Section 6: Finance & Admin Operations
    {
      id: "finance-admin",
      title: "Finance & Admin Operations",
      description:
        "Evaluate back-office efficiency — the often-overlooked time drain.",
      discoveryQuestions: [
        "How do you create and send invoices? How long does it take?",
        "What's your average time to get paid? Any collection issues?",
        "How do you track expenses and profitability?",
        "How much time does your team spend on administrative tasks weekly?",
      ],
      checklistItems: [
        // Invoicing & Payments
        {
          id: "finance-invoices-auto",
          label: "Invoices are generated automatically from deals/projects",
          improvement: "Automate invoice generation from CRM/project system",
          impact: "Save 5+ hours/week, eliminate billing errors",
        },
        {
          id: "finance-online-payment",
          label: "Online payment is enabled",
          improvement: "Enable online payment options (Stripe, etc.)",
          impact: "Get paid 2x faster, reduce DSO by 10-15 days",
        },
        {
          id: "finance-reminders-auto",
          label: "Payment reminders are automated",
          improvement: "Automate payment reminder sequences",
          impact: "Reduce late payments by 40%",
        },
        {
          id: "finance-recurring-billing",
          label: "Recurring billing is automated",
          improvement: "Implement automated recurring billing",
          impact: "Eliminate manual billing, improve cash flow",
        },
        {
          id: "finance-revenue-recognized",
          label: "Revenue is recognized properly",
          improvement: "Implement proper revenue recognition",
          impact: "Accurate financials, compliance",
        },
        // Expense & Profitability
        {
          id: "finance-expenses-tracked",
          label: "Expenses are tracked against projects/clients",
          improvement: "Track expenses by project/client",
          impact: "True profitability visibility by client",
        },
        {
          id: "finance-margins-visible",
          label: "Profit margins are visible per client/project",
          improvement: "Calculate real-time profit margins",
          impact: "Identify unprofitable work, improve pricing",
        },
        {
          id: "finance-reports-automated",
          label: "Financial reports are automated",
          improvement: "Automate financial reporting",
          impact: "Save 10+ hours/month on reporting",
        },
        {
          id: "finance-budget-tracked",
          label: "Budget vs. actual is tracked",
          improvement: "Implement budget tracking and alerts",
          impact: "Control costs, improve project profitability",
        },
        // Administrative
        {
          id: "finance-templates-standardized",
          label: "Document templates are standardized",
          improvement: "Create standardized document templates",
          impact: "Consistent brand, save time on document creation",
        },
        {
          id: "finance-files-organized",
          label: "File storage is organized and accessible",
          improvement: "Organize file storage with clear structure",
          impact: "Find documents instantly, save 3+ hours/week",
        },
        {
          id: "finance-approval-workflows",
          label: "Approval workflows exist for key decisions",
          improvement: "Implement approval workflows",
          impact: "Clear accountability, faster decisions",
        },
        {
          id: "finance-compliance-tracked",
          label: "Compliance/legal documents are tracked",
          improvement: "Track compliance and legal documents",
          impact: "Never miss renewals, reduce legal risk",
        },
      ],
      redFlags: [
        "Invoices created manually in Word/Excel",
        "Chasing payments via email with no system",
        "No idea which clients/projects are actually profitable",
        "Month-end close takes days of manual reconciliation",
        "Documents scattered across drives, inboxes, desktops",
      ],
    },

    // Section 7: Team & Communication Operations
    {
      id: "team-ops",
      title: "Team & Communication Operations",
      description:
        "Assess internal collaboration efficiency and information flow.",
      discoveryQuestions: [
        "How does information flow between departments/teams?",
        "What tools do you use for internal communication?",
        "How do you run meetings? Are they effective?",
        "How does a new hire get up to speed? How long does it take?",
      ],
      checklistItems: [
        // Internal Communication
        {
          id: "team-comm-tool",
          label: "Primary communication tool is defined (Slack, Teams, etc.)",
          improvement: "Standardize on one primary communication tool",
          impact: "Reduce context switching, improve response time",
        },
        {
          id: "team-channels-organized",
          label: "Channel/group structure is organized",
          improvement: "Organize channels by team, project, topic",
          impact: "Find information quickly, reduce noise",
        },
        {
          id: "team-response-expectations",
          label: "Response time expectations are set",
          improvement: "Define and communicate response time SLAs",
          impact: "Clear expectations, less frustration",
        },
        {
          id: "team-updates-reach-everyone",
          label: "Important updates reach everyone",
          improvement: "Implement company-wide announcement system",
          impact: "Everyone stays informed, aligned teams",
        },
        // Meetings & Decisions
        {
          id: "team-meeting-agendas",
          label: "Meeting agendas are required/standard",
          improvement: "Require agendas for all meetings",
          impact: "More productive meetings, save 5+ hours/week",
        },
        {
          id: "team-meeting-notes",
          label: "Meeting notes and action items are captured",
          improvement: "Implement meeting notes and action item tracking",
          impact: "Clear accountability, nothing falls through",
        },
        {
          id: "team-decision-process",
          label: "Decision-making process is clear",
          improvement: "Document decision-making frameworks",
          impact: "Faster decisions, less politics",
        },
        {
          id: "team-status-cadence",
          label: "Status meetings have defined cadence",
          improvement: "Establish regular status meeting rhythm",
          impact: "Everyone aligned, proactive problem solving",
        },
        // Knowledge & Onboarding
        {
          id: "team-sops-documented",
          label: "SOPs and processes are documented",
          improvement: "Document all key processes and SOPs",
          impact: "Consistent execution, reduce tribal knowledge",
        },
        {
          id: "team-knowledge-base",
          label: "Knowledge base or wiki exists",
          improvement: "Create searchable knowledge base",
          impact: "Find answers instantly, reduce interruptions",
        },
        {
          id: "team-onboarding-checklist",
          label: "Onboarding checklist for new hires exists",
          improvement: "Create comprehensive onboarding checklist",
          impact: "Get new hires productive 50% faster",
        },
        {
          id: "team-tribal-knowledge",
          label: "Tribal knowledge is captured, not just in heads",
          improvement: "Document tribal knowledge systematically",
          impact: "Business continuity, reduced key-person risk",
        },
      ],
      redFlags: [
        "Information lives in email threads only certain people can access",
        "\"Let me ask [person]\" is the answer to most questions",
        "Meetings have no agenda and no follow-up",
        "\"Shadow someone for a week\" is the onboarding process",
        "Important decisions aren't documented",
      ],
    },

    // Section 8: Tech Stack Audit
    {
      id: "tech-stack",
      title: "Tech Stack Audit",
      description:
        "Catalog their current tools and identify integration gaps.",
      discoveryQuestions: [
        "What software does your team use on a daily basis?",
        "Which tools do you love? Which do you hate?",
        "How much are you spending on software per month/year?",
        "Where do you manually move data between systems?",
      ],
      checklistItems: [
        {
          id: "tech-crm-email",
          label: "CRM integrates with email",
          improvement: "Integrate CRM with email for automatic logging",
          impact: "Save 5+ hours/week on manual email logging",
        },
        {
          id: "tech-marketing-crm",
          label: "Marketing tools sync with CRM",
          improvement: "Integrate marketing automation with CRM",
          impact: "Unified customer view, personalized outreach",
        },
        {
          id: "tech-pm-crm",
          label: "Project management links to CRM deals",
          improvement: "Connect project management to CRM",
          impact: "End-to-end visibility from sale to delivery",
        },
        {
          id: "tech-invoicing-projects",
          label: "Invoicing pulls from projects/deals",
          improvement: "Automate invoicing from project/deal data",
          impact: "Eliminate manual invoice creation, reduce errors",
        },
        {
          id: "tech-payments-accounting",
          label: "Payments sync with accounting",
          improvement: "Connect payment system to accounting",
          impact: "Automated reconciliation, save 10+ hours/month",
        },
        {
          id: "tech-calendar-crm",
          label: "Calendar integrates with CRM/scheduling",
          improvement: "Integrate calendar with CRM and scheduling",
          impact: "Meeting context automatically captured",
        },
        {
          id: "tech-sso",
          label: "Single sign-on exists",
          improvement: "Implement SSO for all tools",
          impact: "Improved security, easier access management",
        },
        {
          id: "tech-reporting-consolidated",
          label: "Reporting consolidates data from all tools",
          improvement: "Create unified reporting dashboard",
          impact: "Single source of truth, faster decisions",
        },
      ],
      redFlags: [
        "10+ separate tools with no integration",
        "Same data entered in multiple systems",
        "\"Let me check [other tool]\" is a common phrase",
        "No single source of truth for customer data",
        "Paying for tools no one uses",
        "Zapier/manual integrations constantly break",
      ],
    },
  ],
};

// Role-specific conversation starters
export const roleConversationStarters: Record<string, string[]> = {
  "CEO / Founder": [
    "What's keeping you from growing faster right now?",
    "If you could wave a magic wand and fix one operational problem, what would it be?",
    "How much visibility do you have into day-to-day operations without asking someone?",
  ],
  "Ops / COO": [
    "What processes break when you go on vacation?",
    "Where are you manually moving data between systems?",
    "What takes way longer than it should?",
  ],
  "Sales Leader": [
    "How much time does your team spend on admin vs. actually selling?",
    "Do you trust your pipeline numbers?",
    "What happens between \"closed won\" and the client actually getting started?",
  ],
  "Finance / CFO": [
    "How long does it take to get from completed work to paid invoice?",
    "Can you see profitability by client or project in real-time?",
    "What does month-end close look like? How many hours?",
  ],
};

// Import discovery sections for mapping question responses to checklist items
import { discoverySections } from "./sales-call-script";

// Interface for question response data from sales-view
interface QuestionResponse {
  hasCapability: boolean | null;
  notes: string;
}

// Interface for CallData format saved from sales-view
interface CallDataSections {
  [sectionId: string]: {
    [questionId: string]: QuestionResponse;
  };
}

/**
 * Extract checked item IDs from CallData format.
 * When hasCapability is true for a question, all associated checklistItemIds are considered "checked".
 */
function getCheckedItemsFromCallData(sections: CallDataSections): string[] {
  const checkedItems: Set<string> = new Set();
  
  // Iterate through all discovery sections
  for (const section of discoverySections) {
    const sectionResponses = sections[section.id];
    if (!sectionResponses) continue;
    
    // Check each question's response
    for (const question of section.questions) {
      const response = sectionResponses[question.id];
      // If they have the capability, mark all associated checklist items as checked
      if (response?.hasCapability === true) {
        for (const itemId of question.checklistItemIds) {
          checkedItems.add(itemId);
        }
      }
    }
  }
  
  return Array.from(checkedItems);
}

/**
 * Detect if the audit data is in CallData format (from sales-view) vs AuditData format.
 * CallData format has sections with questionId -> QuestionResponse objects.
 * AuditData format has sections with { checkedItems: string[], notes?: string }.
 */
function isCallDataFormat(sections: Record<string, unknown>): sections is CallDataSections {
  const sectionIds = Object.keys(sections);
  if (sectionIds.length === 0) return false;
  
  // Check the first section to determine format
  const firstSection = sections[sectionIds[0]];
  if (!firstSection || typeof firstSection !== "object") return false;
  
  // AuditData format has "checkedItems" array
  if ("checkedItems" in firstSection) return false;
  
  // CallData format has question IDs as keys with hasCapability
  const sectionObj = firstSection as Record<string, unknown>;
  const keys = Object.keys(sectionObj);
  if (keys.length === 0) return true; // Empty section, assume CallData format
  
  const firstValue = sectionObj[keys[0]];
  return firstValue !== null && typeof firstValue === "object" && "hasCapability" in (firstValue as object);
}

/**
 * Get all checked item IDs from audit data, handling both formats.
 */
export function getAllCheckedItemIds(auditData: unknown): string[] {
  if (!auditData || typeof auditData !== "object") return [];
  
  const data = auditData as { sections?: Record<string, unknown> };
  if (!data.sections) return [];
  
  // Check if it's CallData format (from sales-view)
  if (isCallDataFormat(data.sections)) {
    return getCheckedItemsFromCallData(data.sections);
  }
  
  // Otherwise, treat as AuditData format
  const checkedItems: string[] = [];
  for (const sectionData of Object.values(data.sections)) {
    const section = sectionData as { checkedItems?: string[] };
    if (section?.checkedItems) {
      checkedItems.push(...section.checkedItems);
    }
  }
  return checkedItems;
}

// Helper function to calculate section score
export function calculateSectionScore(
  section: AuditSection,
  checkedItems: string[]
): number {
  const totalItems = section.checklistItems.length;
  if (totalItems === 0) return 0;
  const checkedCount = checkedItems.filter((id) =>
    section.checklistItems.some((item) => item.id === id)
  ).length;
  return Math.round((checkedCount / totalItems) * 10);
}

// Helper function to calculate overall score
export function calculateOverallScore(
  auditData: AuditData | null
): { totalScore: number; maxScore: number; percentage: number } {
  if (!auditData?.sections) {
    return { totalScore: 0, maxScore: 80, percentage: 0 };
  }

  // Get all checked items, handling both data formats
  const allCheckedItems = getAllCheckedItemIds(auditData);
  
  let totalScore = 0;
  for (const section of salesAuditConfig.sections) {
    totalScore += calculateSectionScore(section, allCheckedItems);
  }

  return {
    totalScore,
    maxScore: 80,
    percentage: Math.round((totalScore / 80) * 100),
  };
}

// Helper function to get unchecked items with improvements
export function getUncheckedImprovements(
  section: AuditSection,
  checkedItems: string[]
): ChecklistItem[] {
  return section.checklistItems.filter(
    (item) => !checkedItems.includes(item.id)
  );
}
