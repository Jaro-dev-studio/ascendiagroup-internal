// Jaro.dev team members who use an email address outside the @jaro.dev domain.
// These must be treated as internal team members (not clients/prospects) when
// processing meeting participants and transcripts.
export const JARO_DEV_TEAM_EMAILS = ["zenoshubh@gmail.com"];

// Returns true if the email belongs to a Jaro.dev team member, either via the
// @jaro.dev domain or an explicitly listed team email (e.g. personal addresses).
export function isJaroDevTeamEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  const normalized = email.toLowerCase().trim();
  return (
    normalized.endsWith("@jaro.dev") ||
    JARO_DEV_TEAM_EMAILS.some((teamEmail) => teamEmail.toLowerCase() === normalized)
  );
}

// Jaro.dev Internal client company ID - used for internal tasks and studio bug reports
// Tasks and action items for this client are only visible to admins
export const JARO_DEV_INTERNAL_CLIENT_ID = "cmj4hxnct000010wavx845y0t";

// Slack channel ID for sales activity notifications (form submissions)
export const SLACK_SALES_ACTIVITY_CHANNEL_ID = "C07TZUU9W1Y";

// Slack channel ID for operational alerts: cron, webhook, integration and
// outbound email failures. Nobody watches the server logs, so unattended work
// reports itself here instead.
export const SLACK_OPERATIONS_CHANNEL_ID = "C0BP8D4BEG1";

// Seed data only. Page access now lives in the database (see lib/page-access);
// these lists are used once, on the first sync, to create the role defaults.
// Pages accessible by CLIENT role users
export const CLIENT_PAGES: string[] = [
  "/dashboard/client-tasks",
  "/dashboard/client-action-items",
  "/dashboard/feature-requests",
  "/dashboard/bug-requests",
  "/dashboard/studio-bug-report",
  "/dashboard/tutorials",
  "/dashboard/profile",
];

// Pages accessible by DEVELOPER role users
export const DEVELOPER_PAGES: string[] = [
  "/dashboard/tasks",
  "/dashboard/action-items",
  "/dashboard/feature-requests",
  "/dashboard/studio-bug-report",
  "/dashboard/profile",
];