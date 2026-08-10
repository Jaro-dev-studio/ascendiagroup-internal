/**
 * Maps checklist item IDs to their corresponding module codes from the pricing matrix.
 * Based on the BusinessOS Sales Playbook mapping.
 */

export const checklistToModuleMapping: Record<string, string[]> = {
  // === Marketing & Lead Gen (Section 2: marketing-ops) ===
  "marketing-utm-tracking": ["M07"],
  "marketing-handoff-criteria": ["M05"],
  "marketing-email-crm": ["M03"],
  "marketing-landing-pages": ["M02"],
  "marketing-ab-testing": ["M06"],
  "marketing-dashboard": ["M06"],
  "marketing-content-calendar": ["M04"],
  "marketing-social-centralized": ["M04"],
  "marketing-response-under-5min": ["M03", "M04"],
  "marketing-nurture-automated": ["M04"],

  // === Revenue Funnel (Section 1: revenue-funnel) - Marketing related ===
  "funnel-traffic-tracked": ["M01"],
  "funnel-content-measured": ["M01"],
  "funnel-cac-known": ["M01", "M06"],
  "funnel-lead-magnets": ["M02"],
  "funnel-lead-forms": ["M02", "M03"],
  "funnel-crm-auto": ["M02", "M03"],
  "funnel-email-nurture": ["M04"],
  "funnel-lead-scoring": ["M05"],
  "funnel-response-time": ["M03", "M04"],

  // === Revenue Funnel - Sales related ===
  "funnel-sales-stages": ["S02"],
  "funnel-proposals-templated": ["S03"],
  "funnel-contracts-streamlined": ["S04"],
  "funnel-payment-automated": ["F01", "F02"],
  "funnel-win-loss-tracked": ["S09"],

  // === Revenue Funnel - Delivery related ===
  "funnel-onboarding-documented": ["D01"],
  "funnel-handoff-smooth": ["D08"],
  "funnel-project-tracking": ["D02"],
  "funnel-client-comms": ["D03", "D04"],

  // === Revenue Funnel - Customer Success related ===
  "funnel-health-monitored": ["C01"],
  "funnel-renewal-proactive": ["C02"],
  "funnel-upsell-triggers": ["C04"],
  "funnel-referral-system": ["C06"],

  // === Sales Operations (Section 3: sales-ops) ===
  "sales-crm-consistent": ["S01"],
  "sales-stages-defined": ["S02"],
  "sales-values-tracked": ["S02"],
  "sales-pipeline-reviewed": ["S08"],
  "sales-win-rates-known": ["S09"],
  "sales-email-templates": ["S05"],
  "sales-proposals-automated": ["S03"],
  "sales-scheduling-self-service": ["S06"],
  "sales-activity-logged": ["S07"],
  "sales-followup-automated": ["S07", "M04"],
  "sales-contracts-standardized": ["S04"],
  "sales-esignature": ["S04"],
  "sales-payment-terms": ["F01"],
  "sales-triggers-fulfillment": ["D08"],

  // === Delivery & Fulfillment (Section 4: delivery-ops) ===
  "delivery-onboarding-checklist": ["D01"],
  "delivery-info-transfer": ["D08"],
  "delivery-kickoff-template": ["D01"],
  "delivery-client-portal": ["D03"],
  "delivery-timeline-shared": ["D02"],
  "delivery-single-system": ["D02"],
  "delivery-tasks-clear": ["D02"],
  "delivery-time-tracking": ["D05"],
  "delivery-status-automated": ["D04"],
  "delivery-scope-documented": ["D06"],
  "delivery-dependencies": ["D02"],
  "delivery-quality-checkpoints": ["D07"],
  "delivery-signoff-defined": ["D07"],
  "delivery-retrospectives": ["D07"],
  "delivery-invoicing-trigger": ["F01"],

  // === Customer Success (Section 5: customer-success) ===
  "success-health-scores": ["C01"],
  "success-usage-monitored": ["C01"],
  "success-nps-csat": ["C03"],
  "success-at-risk-flagged": ["C01"],
  "success-check-ins": ["C01"],
  "success-renewal-tracked": ["C02"],
  "success-renewal-outreach": ["C02"],
  "success-upsell-playbooks": ["C04"],
  "success-account-plans": ["C05"],
  "success-case-studies": ["C05"],
  "success-testimonials": ["C03"],
  "success-referral-incentives": ["C06"],
  "success-community": ["C06"],

  // === Finance & Admin (Section 6: finance-admin) ===
  "finance-invoices-auto": ["F01"],
  "finance-online-payment": ["F02"],
  "finance-reminders-auto": ["F03"],
  "finance-recurring-billing": ["F04"],
  "finance-revenue-recognized": ["F07"],
  "finance-expenses-tracked": ["F06"],
  "finance-margins-visible": ["F05"],
  "finance-reports-automated": ["F05"],
  "finance-budget-tracked": ["F05"],
  "finance-templates-standardized": ["S05"],
  "finance-files-organized": ["I05"],
  "finance-approval-workflows": ["D07"],
  "finance-compliance-tracked": ["F07"],

  // === Team & Communication (Section 7: team-ops) ===
  "team-comm-tool": ["I04"],
  "team-channels-organized": ["I04"],
  "team-response-expectations": ["I04"],
  "team-updates-reach-everyone": ["I04"],
  "team-meeting-agendas": ["I05"],
  "team-meeting-notes": ["I05"],
  "team-decision-process": ["I05"],
  "team-status-cadence": ["I05"],
  "team-sops-documented": ["D01"],
  "team-knowledge-base": ["D03"],
  "team-onboarding-checklist": ["D01"],
  "team-tribal-knowledge": ["D03"],

  // === Tech Stack (Section 8: tech-stack) ===
  "tech-crm-email": ["S07"],
  "tech-marketing-crm": ["M03"],
  "tech-pm-crm": ["D02", "S01"],
  "tech-invoicing-projects": ["F01"],
  "tech-payments-accounting": ["F07"],
  "tech-calendar-crm": ["S06"],
  "tech-sso": ["I08"],
  "tech-reporting-consolidated": ["M06", "S08", "F05"],
};

/**
 * Get module codes for a checklist item
 */
export function getModuleCodesForItem(itemId: string): string[] {
  return checklistToModuleMapping[itemId] || [];
}

/**
 * Get all unique module codes from a list of unchecked item IDs
 */
export function getModuleCodesFromUncheckedItems(uncheckedItemIds: string[]): string[] {
  const allCodes = uncheckedItemIds.flatMap(
    (id) => checklistToModuleMapping[id] || []
  );
  return [...new Set(allCodes)];
}
