// Hand-maintained metadata for the generated page registry.
// scripts/generate-page-registry.ts reads this to label and group discovered pages.
// Anything not listed here falls back to a title-cased route segment and the "Other" group.

// Pages that are never access-controlled: every authenticated user can reach them.
export const ALWAYS_ALLOWED_PAGE_PATHS: string[] = [
  "/dashboard",
  "/dashboard/profile",
];

// Allowed paths normally cover their sub-routes. These are matched exactly instead,
// so the dashboard root does not silently grant access to every page beneath it.
export const EXACT_MATCH_ONLY_PATHS: string[] = ["/dashboard"];

// Group render order in the admin UI and the sidebar.
export const PAGE_GROUP_ORDER: string[] = [
  "Overview",
  "Advertising",
  "Sales",
  "CRM",
  "Operations",
  "Admin",
  "Client",
  "Other",
];

export const PAGE_GROUPS: Record<string, string> = {
  "/dashboard/overview": "Overview",

  "/dashboard/case-studies": "Advertising",
  "/dashboard/offers": "Advertising",
  "/dashboard/submissions": "Advertising",
  "/dashboard/live-funnel": "Advertising",
  "/dashboard/ads": "Advertising",

  "/dashboard/upcoming-calls": "Sales",
  "/dashboard/sales-call-maps": "Sales",
  "/dashboard/mvp-call-maps": "Sales",
  "/dashboard/demos": "Sales",

  "/dashboard/crm/people": "CRM",
  "/dashboard/crm/companies": "CRM",
  "/dashboard/crm/deals": "CRM",
  "/dashboard/crm/sequences": "CRM",
  "/dashboard/crm/recording-rules": "CRM",

  "/dashboard/tasks": "Operations",
  "/dashboard/clients": "Operations",
  "/dashboard/calls": "Operations",
  "/dashboard/action-items": "Operations",
  "/dashboard/feature-requests": "Operations",
  "/dashboard/workflow-maps": "Operations",

  "/dashboard/users": "Admin",
  "/dashboard/page-access": "Admin",
  "/dashboard/notifications": "Admin",
  "/dashboard/recurring-tasks": "Admin",
  "/dashboard/calculation": "Admin",
  "/dashboard/presentations": "Admin",
  "/dashboard/sam-gov": "Admin",
  "/dashboard/knowledge-base": "Admin",
  "/dashboard/settings/followup-templates": "Admin",

  "/dashboard/client-tasks": "Client",
  "/dashboard/client-action-items": "Client",
  "/dashboard/bug-requests": "Client",
  "/dashboard/studio-bug-report": "Client",
  "/dashboard/tutorials": "Client",
};

// Labels that differ from the title-cased route segment.
export const PAGE_LABELS: Record<string, string> = {
  "/dashboard/ads": "Ads",
  "/dashboard/submissions": "Form Submissions",
  "/dashboard/calls": "Past Calls",
  "/dashboard/feature-requests": "Requests",
  "/dashboard/sales-call-maps": "Call Maps",
  "/dashboard/mvp-call-maps": "MVP Call Maps",
  "/dashboard/demos": "Products",
  "/dashboard/crm/companies": "Accounts",
  "/dashboard/calculation": "Calculations",
  "/dashboard/sam-gov": "SAM.gov",
  "/dashboard/settings/followup-templates": "Followup Templates",
  "/dashboard/client-tasks": "Jaro.dev Tasks",
  "/dashboard/client-action-items": "Client Action Items",
  "/dashboard/bug-requests": "Bug Fix Requests",
  "/dashboard/studio-bug-report": "Studio Platform Bug Report",
};

export const DEFAULT_PAGE_GROUP = "Other";
