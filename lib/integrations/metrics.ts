import "server-only";

import type { Client, IntegrationProvider } from "@prisma/client";

import prisma from "@/lib/prisma";
import { agencyAnalyticsQuery } from "./agency-analytics";
import { getOAuthAccessToken } from "./google-auth";
import { getIntegrationCredentials } from "./store";

export interface MetricInput {
  provider: IntegrationProvider;
  metricKey: string;
  label: string;
  value: number;
  unit?: string;
}

function periodBounds(days = 30) {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - days * 86_400_000);
  periodStart.setHours(0, 0, 0, 0);
  return { periodStart, periodEnd };
}

async function fetchSemrushMetrics(client: Client): Promise<MetricInput[]> {
  const credentials = await getIntegrationCredentials("SEMRUSH");
  if (!credentials?.apiKey || !client.website) return [];

  const domain = client.website.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const url = new URL("https://api.semrush.com/");
  url.searchParams.set("type", "domain_ranks");
  url.searchParams.set("key", credentials.apiKey);
  url.searchParams.set("domain", domain);
  url.searchParams.set("database", credentials.database || "us");
  url.searchParams.set("export_columns", "Rk,Or,Ot,Oc");

  console.log(`[Reporting] fetching SEMrush visibility for ${domain}...`);
  const response = await fetch(url);
  const body = await response.text();

  if (!response.ok || body.startsWith("ERROR")) {
    throw new Error(body.slice(0, 200) || `SEMrush HTTP ${response.status}`);
  }

  const [, valuesLine] = body.trim().split("\n");
  if (!valuesLine) return [];

  const [rank, organicKeywords, organicTraffic, organicCost] = valuesLine
    .split(";")
    .map((value) => Number(value) || 0);

  return [
    {
      provider: "SEMRUSH",
      metricKey: "organic_keywords",
      label: "Organic keywords",
      value: organicKeywords,
    },
    {
      provider: "SEMRUSH",
      metricKey: "organic_traffic",
      label: "Estimated organic traffic",
      value: organicTraffic,
      unit: "visits",
    },
    {
      provider: "SEMRUSH",
      metricKey: "organic_cost",
      label: "Organic traffic value",
      value: organicCost,
      unit: "USD",
    },
    {
      provider: "SEMRUSH",
      metricKey: "semrush_rank",
      label: "SEMrush rank",
      value: rank,
    },
  ];
}

async function fetchAgencyAnalyticsMetrics(
  client: Client
): Promise<MetricInput[]> {
  const credentials = await getIntegrationCredentials("AGENCY_ANALYTICS");
  if (!credentials?.apiKey) return [];

  const link = await prisma.clientIntegrationLink.findUnique({
    where: { clientId_provider: { clientId: client.id, provider: "AGENCY_ANALYTICS" } },
  });
  if (!link) return [];

  console.log(
    `[Reporting] fetching AgencyAnalytics campaign ${link.externalId} stats...`
  );

  const response = await agencyAnalyticsQuery(credentials.apiKey, {
    asset: "analytics",
    connector_type: "google-analytics-4",
    campaign_id: link.externalId,
    operation: "read",
    fields: ["sessions", "users", "conversions", "bounce_rate"],
    limit: 1,
  });

  if (response.status !== "success") {
    throw new Error(
      `AgencyAnalytics: ${response.messages.join(", ") || `HTTP ${response.code}`}`
    );
  }

  const row = response.results[0] ?? {};
  const metrics: MetricInput[] = [];

  for (const [key, label] of [
    ["sessions", "Website sessions"],
    ["users", "Unique users"],
    ["conversions", "Conversions"],
    ["bounce_rate", "Bounce rate"],
  ] as const) {
    const raw = Number(row[key]);
    if (Number.isFinite(raw)) {
      metrics.push({
        provider: "AGENCY_ANALYTICS",
        metricKey: key,
        label,
        value: raw,
        unit: key === "bounce_rate" ? "%" : undefined,
      });
    }
  }

  return metrics;
}

async function fetchGoogleAdsMetrics(client: Client): Promise<MetricInput[]> {
  const credentials = await getIntegrationCredentials("GOOGLE_ADS");
  if (!credentials?.developerToken) return [];

  const link = await prisma.clientIntegrationLink.findUnique({
    where: { clientId_provider: { clientId: client.id, provider: "GOOGLE_ADS" } },
  });
  if (!link) return [];

  const customerId = link.externalId.replace(/-/g, "");
  console.log(`[Reporting] fetching Google Ads metrics for ${customerId}...`);

  const token = await getOAuthAccessToken({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    refreshToken: credentials.refreshToken,
  });

  const response = await fetch(
    `https://googleads.googleapis.com/v21/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "developer-token": credentials.developerToken,
        "Content-Type": "application/json",
        ...(credentials.loginCustomerId
          ? { "login-customer-id": credentials.loginCustomerId.replace(/-/g, "") }
          : {}),
      },
      body: JSON.stringify({
        query:
          "SELECT metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions FROM customer WHERE segments.date DURING LAST_30_DAYS",
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Google Ads HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`
    );
  }

  const payload = (await response.json()) as {
    results?: {
      metrics?: {
        costMicros?: string;
        clicks?: string;
        impressions?: string;
        conversions?: number;
      };
    }[];
  }[];

  const totals = { cost: 0, clicks: 0, impressions: 0, conversions: 0 };
  for (const chunk of payload) {
    for (const row of chunk.results ?? []) {
      totals.cost += Number(row.metrics?.costMicros ?? 0) / 1_000_000;
      totals.clicks += Number(row.metrics?.clicks ?? 0);
      totals.impressions += Number(row.metrics?.impressions ?? 0);
      totals.conversions += Number(row.metrics?.conversions ?? 0);
    }
  }

  return [
    {
      provider: "GOOGLE_ADS",
      metricKey: "ad_spend",
      label: "Ad spend",
      value: Math.round(totals.cost * 100) / 100,
      unit: "USD",
    },
    {
      provider: "GOOGLE_ADS",
      metricKey: "clicks",
      label: "Ad clicks",
      value: totals.clicks,
    },
    {
      provider: "GOOGLE_ADS",
      metricKey: "impressions",
      label: "Ad impressions",
      value: totals.impressions,
    },
    {
      provider: "GOOGLE_ADS",
      metricKey: "conversions",
      label: "Ad conversions",
      value: Math.round(totals.conversions),
    },
  ];
}

export async function syncClientMetrics(clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("Client not found");

  console.log(`[Reporting] syncing metrics for ${client.name}...`);

  const { periodStart, periodEnd } = periodBounds();
  const results = await Promise.allSettled([
    fetchSemrushMetrics(client),
    fetchAgencyAnalyticsMetrics(client),
    fetchGoogleAdsMetrics(client),
  ]);

  const metrics: MetricInput[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      metrics.push(...result.value);
    } else {
      errors.push(
        result.reason instanceof Error ? result.reason.message : String(result.reason)
      );
    }
  }

  for (const metric of metrics) {
    await prisma.clientMetric.upsert({
      where: {
        clientId_provider_metricKey_periodStart: {
          clientId,
          provider: metric.provider,
          metricKey: metric.metricKey,
          periodStart,
        },
      },
      create: {
        clientId,
        provider: metric.provider,
        metricKey: metric.metricKey,
        label: metric.label,
        value: metric.value,
        unit: metric.unit,
        periodStart,
        periodEnd,
      },
      update: {
        value: metric.value,
        label: metric.label,
        unit: metric.unit,
        periodEnd,
        capturedAt: new Date(),
      },
    });
  }

  console.log(
    `[Reporting] stored ${metrics.length} metrics for ${client.name} (${errors.length} source errors)`
  );

  return { count: metrics.length, errors };
}
