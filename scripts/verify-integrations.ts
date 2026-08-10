/**
 * Probes every integration endpoint the app calls with the credentials stored in
 * the database (or a placeholder when none are stored) and prints the HTTP
 * status. A 401/403 confirms the URL, headers and auth scheme are the ones the
 * provider expects; a 404 or DNS failure would mean the request shape is wrong.
 *
 * Run with: pnpm verify:integrations
 */
import crypto from "crypto";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Mirrors lib/crypto.ts, which is server-only and cannot be imported here. */
function decryptCredentials(payload?: string | null) {
  if (!payload) return null;

  try {
    const [ivPart, tagPart, dataPart] = payload.split(".");
    if (!ivPart || !tagPart || !dataPart) return null;

    const key = crypto
      .createHash("sha256")
      .update(process.env.APP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "")
      .digest();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivPart, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64"));

    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(dataPart, "base64")),
        decipher.final(),
      ]).toString("utf8")
    ) as Record<string, string>;
  } catch {
    return null;
  }
}

interface Probe {
  name: string;
  provider: string;
  build: (credentials: Record<string, string>) => {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };
}

const PROBES: Probe[] = [
  {
    name: "Claude — list models",
    provider: "CLAUDE",
    build: (credentials) => ({
      url: "https://api.anthropic.com/v1/models?limit=1",
      headers: {
        "x-api-key": credentials.apiKey ?? "placeholder",
        "anthropic-version": "2023-06-01",
      },
    }),
  },
  {
    name: "Trello — members/me",
    provider: "TRELLO",
    build: (credentials) => ({
      url: `https://api.trello.com/1/members/me?key=${credentials.apiKey ?? "placeholder"}&token=${credentials.token ?? "placeholder"}&fields=username`,
    }),
  },
  {
    name: "WhatsApp Business — phone number",
    provider: "WHATSAPP",
    build: (credentials) => ({
      url: `https://graph.facebook.com/v21.0/${credentials.phoneNumberId ?? "000"}?fields=display_phone_number`,
      headers: {
        Authorization: `Bearer ${credentials.accessToken ?? "placeholder"}`,
      },
    }),
  },
  {
    name: "Call recorder — bot list",
    provider: "CALL_RECORDING",
    build: (credentials) => ({
      url: `https://${credentials.region || "us-east-1.recall.ai"}/api/v1/bot/?limit=1`,
      headers: { Authorization: `Token ${credentials.apiKey ?? "placeholder"}` },
    }),
  },
  {
    name: "Google Drive — files",
    provider: "GOOGLE_DRIVE",
    build: () => ({
      url: "https://www.googleapis.com/drive/v3/files?pageSize=1",
      headers: { Authorization: "Bearer placeholder" },
    }),
  },
  {
    name: "Google Business Profile — accounts",
    provider: "GOOGLE_BUSINESS_PROFILE",
    build: () => ({
      url: "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      headers: { Authorization: "Bearer placeholder" },
    }),
  },
  {
    name: "Google Ads — accessible customers",
    provider: "GOOGLE_ADS",
    build: (credentials) => ({
      url: "https://googleads.googleapis.com/v21/customers:listAccessibleCustomers",
      headers: {
        Authorization: "Bearer placeholder",
        "developer-token": credentials.developerToken ?? "placeholder",
      },
    }),
  },
  {
    name: "AgencyAnalytics — campaigns",
    provider: "AGENCY_ANALYTICS",
    build: (credentials) => ({
      url: "https://apirequest.app/query",
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`:${credentials.apiKey ?? "placeholder"}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: "agency-analytics-v2",
        asset: "campaign",
        operation: "read",
        fields: ["id", "company", "url"],
        limit: 1,
      }),
    }),
  },
  {
    name: "SEMrush — domain ranks",
    provider: "SEMRUSH",
    build: (credentials) => ({
      url: `https://api.semrush.com/?type=domain_ranks&key=${credentials.apiKey ?? "placeholder"}&domain=semrush.com&database=us&export_columns=Db,Dn,Rk,Or,Ot`,
    }),
  },
  {
    name: "GoHighLevel — location",
    provider: "GOHIGHLEVEL",
    build: (credentials) => ({
      url: `https://services.leadconnectorhq.com/locations/${credentials.locationId ?? "placeholder"}`,
      headers: {
        Authorization: `Bearer ${credentials.accessToken ?? "placeholder"}`,
        Version: "2021-07-28",
        Accept: "application/json",
      },
    }),
  },
];

async function main() {
  const records = await prisma.integration.findMany();
  const stored = new Map(
    records.map((record) => [
      record.provider as string,
      decryptCredentials(record.credentials) ?? {},
    ])
  );

  console.log("[Verify] probing integration endpoints...\n");

  for (const probe of PROBES) {
    const credentials = stored.get(probe.provider) ?? {};
    const hasCredentials = Object.keys(credentials).length > 0;
    const { url, method, headers, body: requestBody } = probe.build(credentials);

    try {
      const response = await fetch(url, {
        method: method ?? "GET",
        headers,
        body: requestBody,
      });
      const body = (await response.text()).replace(/\s+/g, " ").slice(0, 130);

      console.log(
        `${response.ok ? "OK  " : "AUTH"} ${String(response.status).padEnd(3)} ${probe.name}${
          hasCredentials ? " (stored credentials)" : " (placeholder credentials)"
        }`
      );
      console.log(`      ${body}\n`);
    } catch (error) {
      console.log(`FAIL      ${probe.name}`);
      console.log(
        `      ${error instanceof Error ? error.message : String(error)}\n`
      );
    }
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
