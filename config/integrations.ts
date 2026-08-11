import type { IntegrationProvider } from "@prisma/client";

export interface IntegrationField {
  key: string;
  label: string;
  type: "text" | "password" | "textarea";
  placeholder?: string;
  required?: boolean;
  help?: string;
}

export interface IntegrationDefinition {
  provider: IntegrationProvider;
  name: string;
  category: "Core" | "Delivery" | "Marketing data";
  summary: string;
  capabilities: string[];
  docsUrl: string;
  fields: IntegrationField[];
  /** Providers that receive data instead of being polled. */
  webhookPath?: string;
}

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    provider: "CLAUDE",
    name: "Claude",
    category: "Core",
    summary:
      "Powers 90-day strategy generation, meeting summaries and the knowledge base assistant.",
    capabilities: [
      "Generate 30/60/90 day roadmaps",
      "Summarise call transcripts into next steps",
      "Answer questions grounded in a client knowledge base",
    ],
    docsUrl: "https://docs.anthropic.com/en/api/getting-started",
    fields: [
      {
        key: "apiKey",
        label: "API key",
        type: "password",
        placeholder: "sk-ant-...",
        required: true,
      },
      {
        key: "model",
        label: "Model",
        type: "text",
        placeholder: "claude-sonnet-4-5",
        help: "Defaults to claude-sonnet-4-5 when left blank.",
      },
    ],
  },
  {
    provider: "TRELLO",
    name: "Trello",
    category: "Delivery",
    summary:
      "Mirrors onboarding projects to a Trello board so delivery teams keep their existing workflow.",
    capabilities: [
      "Create a board per client project",
      "Push onboarding and strategy tasks as cards",
    ],
    docsUrl: "https://developer.atlassian.com/cloud/trello/rest/",
    fields: [
      {
        key: "apiKey",
        label: "API key",
        type: "password",
        required: true,
        help: "From trello.com/power-ups/admin.",
      },
      { key: "token", label: "API token", type: "password", required: true },
    ],
  },
  {
    provider: "WHATSAPP",
    name: "WhatsApp Business",
    category: "Core",
    summary:
      "Captures client WhatsApp conversations into the project timeline and knowledge base.",
    capabilities: [
      "Ingest inbound messages and media via webhook",
      "Attach conversations to the right client automatically",
    ],
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    webhookPath: "/api/webhooks/whatsapp",
    fields: [
      {
        key: "phoneNumberId",
        label: "Phone number ID",
        type: "text",
        required: true,
      },
      {
        key: "accessToken",
        label: "Access token",
        type: "password",
        required: true,
      },
      {
        key: "verifyToken",
        label: "Webhook verify token",
        type: "text",
        required: true,
        help: "Meta calls the webhook with this value to confirm ownership.",
      },
    ],
  },
  {
    provider: "CALL_RECORDING",
    name: "Call recording",
    category: "Core",
    summary:
      "Receives sales and strategy call recordings plus transcripts and files them against the client.",
    capabilities: [
      "Accept transcript webhooks from your recorder",
      "Auto-summarise calls into next steps and action items",
    ],
    docsUrl: "https://docs.recall.ai/reference/bot_list",
    webhookPath: "/api/webhooks/call-recording",
    fields: [
      {
        key: "apiKey",
        label: "API key",
        type: "password",
        required: true,
      },
      {
        key: "region",
        label: "Region host",
        type: "text",
        placeholder: "us-east-1.recall.ai",
        help: "Base host of your recorder API.",
      },
    ],
  },
  {
    provider: "GOOGLE_DRIVE",
    name: "Google Drive",
    category: "Delivery",
    summary:
      "Creates a dedicated Drive folder per client and links it from the project workspace.",
    capabilities: [
      "Create client folders under a shared drive",
      "Store credentials, assets and deliverables",
    ],
    docsUrl: "https://developers.google.com/drive/api/reference/rest/v3",
    fields: [
      {
        key: "serviceAccountJson",
        label: "Service account JSON",
        type: "textarea",
        required: true,
        help: "Needs drive.file scope and access to the parent folder.",
      },
      {
        key: "parentFolderId",
        label: "Parent folder ID",
        type: "text",
        required: true,
      },
    ],
  },
  {
    provider: "GOOGLE_BUSINESS_PROFILE",
    name: "Google Business Profile",
    category: "Marketing data",
    summary:
      "Pulls local listing performance so account managers can report on calls, views and directions.",
    capabilities: ["Sync profile insights into client reporting"],
    docsUrl:
      "https://developers.google.com/my-business/reference/businessinformation/rest",
    fields: [
      {
        key: "serviceAccountJson",
        label: "Service account JSON",
        type: "textarea",
        required: true,
      },
      { key: "accountId", label: "Account ID", type: "text", required: true },
    ],
  },
  {
    provider: "GOOGLE_ADS",
    name: "Google Ads",
    category: "Marketing data",
    summary:
      "Runs account audits and pulls spend, conversions and cost per lead into reporting.",
    capabilities: ["Import campaign performance", "Support account audits"],
    docsUrl: "https://developers.google.com/google-ads/api/docs/start",
    fields: [
      {
        key: "developerToken",
        label: "Developer token",
        type: "password",
        required: true,
      },
      { key: "clientId", label: "OAuth client ID", type: "text", required: true },
      {
        key: "clientSecret",
        label: "OAuth client secret",
        type: "password",
        required: true,
      },
      {
        key: "refreshToken",
        label: "Refresh token",
        type: "password",
        required: true,
      },
      {
        key: "loginCustomerId",
        label: "Manager customer ID",
        type: "text",
        placeholder: "1234567890",
      },
    ],
  },
  {
    provider: "AGENCY_ANALYTICS",
    name: "AgencyAnalytics",
    category: "Marketing data",
    summary:
      "Syncs campaign KPIs from AgencyAnalytics into the internal and client-facing dashboards.",
    capabilities: ["Import campaign KPIs", "Feed weekly and monthly reports"],
    docsUrl: "https://help.agencyanalytics.com/en/articles/8219563-using-the-agencyanalytics-api",
    fields: [
      { key: "apiKey", label: "API key", type: "password", required: true },
    ],
  },
  {
    provider: "SEMRUSH",
    name: "SEMrush",
    category: "Marketing data",
    summary:
      "Pulls organic visibility and keyword data used in the initial audit and ongoing reporting.",
    capabilities: ["Domain visibility snapshots", "Keyword baselines"],
    docsUrl: "https://developer.semrush.com/api/v3/analytics/domain-overviews/",
    fields: [
      { key: "apiKey", label: "API key", type: "password", required: true },
      {
        key: "database",
        label: "Database",
        type: "text",
        placeholder: "us",
        help: "Regional database used for lookups. Defaults to us.",
      },
    ],
  },
  {
    provider: "GOHIGHLEVEL",
    name: "GoHighLevel",
    category: "Delivery",
    summary:
      "Connects the client sub-account so leads and pipeline activity land in the delivery workflow.",
    capabilities: ["Verify sub-account access", "Trigger workflows"],
    docsUrl: "https://highlevel.stoplight.io/docs/integrations",
    fields: [
      {
        key: "accessToken",
        label: "API access token",
        type: "password",
        required: true,
      },
      { key: "locationId", label: "Location ID", type: "text", required: true },
    ],
  },
];

export function getIntegrationDefinition(provider: IntegrationProvider) {
  return INTEGRATIONS.find((item) => item.provider === provider);
}

export const INTEGRATION_LABELS = INTEGRATIONS.reduce(
  (accumulator, item) => {
    accumulator[item.provider] = item.name;
    return accumulator;
  },
  {} as Record<IntegrationProvider, string>
);
