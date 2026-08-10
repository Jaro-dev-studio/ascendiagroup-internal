import "server-only";

import type { IntegrationProvider } from "@prisma/client";

import { getGoogleAccessToken, getOAuthAccessToken } from "./google-auth";
import type { IntegrationCredentials } from "./store";

export interface ConnectionResult {
  ok: boolean;
  message: string;
  accountLabel?: string;
}

async function readError(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text);
    return (
      parsed?.error?.message ||
      parsed?.error_description ||
      parsed?.message ||
      parsed?.error ||
      text.slice(0, 200)
    );
  } catch {
    return text.slice(0, 200) || `HTTP ${response.status}`;
  }
}

async function testClaude(credentials: IntegrationCredentials): Promise<ConnectionResult> {
  const response = await fetch("https://api.anthropic.com/v1/models?limit=1", {
    headers: {
      "x-api-key": credentials.apiKey,
      "anthropic-version": "2023-06-01",
    },
  });

  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }

  const payload = (await response.json()) as { data?: { id: string }[] };
  return {
    ok: true,
    message: "Claude API key verified.",
    accountLabel: credentials.model || payload.data?.[0]?.id || "Anthropic",
  };
}

async function testTrello(credentials: IntegrationCredentials): Promise<ConnectionResult> {
  const url = new URL("https://api.trello.com/1/members/me");
  url.searchParams.set("key", credentials.apiKey);
  url.searchParams.set("token", credentials.token);
  url.searchParams.set("fields", "username,fullName");

  const response = await fetch(url);
  if (!response.ok) return { ok: false, message: await readError(response) };

  const payload = (await response.json()) as {
    username?: string;
    fullName?: string;
  };

  return {
    ok: true,
    message: "Trello account connected.",
    accountLabel: payload.fullName || payload.username,
  };
}

async function testWhatsApp(credentials: IntegrationCredentials): Promise<ConnectionResult> {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}?fields=display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${credentials.accessToken}` } }
  );

  if (!response.ok) return { ok: false, message: await readError(response) };

  const payload = (await response.json()) as {
    display_phone_number?: string;
    verified_name?: string;
  };

  return {
    ok: true,
    message: "WhatsApp Business number verified.",
    accountLabel: [payload.verified_name, payload.display_phone_number]
      .filter(Boolean)
      .join(" · "),
  };
}

async function testCallRecording(
  credentials: IntegrationCredentials
): Promise<ConnectionResult> {
  const host = credentials.region?.trim() || "us-east-1.recall.ai";
  const response = await fetch(`https://${host}/api/v1/bot/?limit=1`, {
    headers: { Authorization: `Token ${credentials.apiKey}` },
  });

  if (!response.ok) return { ok: false, message: await readError(response) };

  return {
    ok: true,
    message: "Call recorder API reachable.",
    accountLabel: host,
  };
}

async function testGoogleDrive(
  credentials: IntegrationCredentials
): Promise<ConnectionResult> {
  const token = await getGoogleAccessToken(credentials.serviceAccountJson, [
    "https://www.googleapis.com/auth/drive",
  ]);

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${credentials.parentFolderId}?fields=id,name&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) return { ok: false, message: await readError(response) };

  const payload = (await response.json()) as { name?: string };
  return {
    ok: true,
    message: "Drive parent folder reachable.",
    accountLabel: payload.name,
  };
}

async function testGoogleBusinessProfile(
  credentials: IntegrationCredentials
): Promise<ConnectionResult> {
  const token = await getGoogleAccessToken(credentials.serviceAccountJson, [
    "https://www.googleapis.com/auth/business.manage",
  ]);

  const response = await fetch(
    `https://mybusinessaccountmanagement.googleapis.com/v1/accounts/${credentials.accountId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) return { ok: false, message: await readError(response) };

  const payload = (await response.json()) as { accountName?: string };
  return {
    ok: true,
    message: "Business Profile account reachable.",
    accountLabel: payload.accountName,
  };
}

async function testGoogleAds(
  credentials: IntegrationCredentials
): Promise<ConnectionResult> {
  const token = await getOAuthAccessToken({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    refreshToken: credentials.refreshToken,
  });

  const response = await fetch(
    "https://googleads.googleapis.com/v18/customers:listAccessibleCustomers",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "developer-token": credentials.developerToken,
        ...(credentials.loginCustomerId
          ? { "login-customer-id": credentials.loginCustomerId.replace(/-/g, "") }
          : {}),
      },
    }
  );

  if (!response.ok) return { ok: false, message: await readError(response) };

  const payload = (await response.json()) as { resourceNames?: string[] };
  return {
    ok: true,
    message: `${payload.resourceNames?.length ?? 0} accessible ad accounts.`,
    accountLabel: payload.resourceNames?.[0]?.split("/").pop(),
  };
}

async function testAgencyAnalytics(
  credentials: IntegrationCredentials
): Promise<ConnectionResult> {
  const response = await fetch(
    "https://api.agencyanalytics.com/v1/campaigns?limit=1",
    {
      headers: {
        "X-Api-Key": credentials.apiKey,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) return { ok: false, message: await readError(response) };

  const payload = (await response.json()) as { data?: unknown[] };
  return {
    ok: true,
    message: `${payload.data?.length ?? 0} campaigns visible.`,
    accountLabel: "AgencyAnalytics",
  };
}

async function testSemrush(
  credentials: IntegrationCredentials
): Promise<ConnectionResult> {
  const url = new URL("https://api.semrush.com/");
  url.searchParams.set("type", "domain_ranks");
  url.searchParams.set("key", credentials.apiKey);
  url.searchParams.set("domain", "semrush.com");
  url.searchParams.set("database", credentials.database || "us");
  url.searchParams.set("export_columns", "Db,Dn,Rk,Or,Ot");

  const response = await fetch(url);
  const body = await response.text();

  if (!response.ok || body.startsWith("ERROR")) {
    return { ok: false, message: body.slice(0, 200) || `HTTP ${response.status}` };
  }

  return {
    ok: true,
    message: "SEMrush API key verified.",
    accountLabel: `Database: ${credentials.database || "us"}`,
  };
}

async function testGoHighLevel(
  credentials: IntegrationCredentials
): Promise<ConnectionResult> {
  const response = await fetch(
    `https://services.leadconnectorhq.com/locations/${credentials.locationId}`,
    {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        Version: "2021-07-28",
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) return { ok: false, message: await readError(response) };

  const payload = (await response.json()) as { location?: { name?: string } };
  return {
    ok: true,
    message: "GoHighLevel sub-account reachable.",
    accountLabel: payload.location?.name,
  };
}

const TESTERS: Record<
  IntegrationProvider,
  (credentials: IntegrationCredentials) => Promise<ConnectionResult>
> = {
  CLAUDE: testClaude,
  TRELLO: testTrello,
  WHATSAPP: testWhatsApp,
  CALL_RECORDING: testCallRecording,
  GOOGLE_DRIVE: testGoogleDrive,
  GOOGLE_BUSINESS_PROFILE: testGoogleBusinessProfile,
  GOOGLE_ADS: testGoogleAds,
  AGENCY_ANALYTICS: testAgencyAnalytics,
  SEMRUSH: testSemrush,
  GOHIGHLEVEL: testGoHighLevel,
};

export async function testIntegrationConnection(
  provider: IntegrationProvider,
  credentials: IntegrationCredentials
): Promise<ConnectionResult> {
  console.log(`[Integrations] testing ${provider} connection...`);

  try {
    const result = await TESTERS[provider](credentials);
    console.log(
      `[Integrations] ${provider} test ${result.ok ? "succeeded" : "failed"}: ${result.message}`
    );
    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected connection error";
    console.error(`[Integrations] ${provider} test threw`, error);
    return { ok: false, message };
  }
}
