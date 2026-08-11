import "server-only";

import crypto from "crypto";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function parseServiceAccount(raw: string): ServiceAccount {
  const text = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  const parsed = JSON.parse(text) as ServiceAccount;

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Service account JSON is missing client_email or private_key");
  }

  return parsed;
}

/**
 * Exchanges a service account for an access token using the JWT bearer flow.
 * Avoids pulling in the full googleapis client for two REST calls.
 */
export async function getGoogleAccessToken(
  serviceAccountJson: string,
  scopes: string[],
  subject?: string
): Promise<string> {
  const account = parseServiceAccount(serviceAccountJson);
  const tokenUri = account.token_uri ?? "https://oauth2.googleapis.com/token";
  const issuedAt = Math.floor(Date.now() / 1000);

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: scopes.join(" "),
      aud: tokenUri,
      exp: issuedAt + 3600,
      iat: issuedAt,
      ...(subject ? { sub: subject } : {}),
    })
  );

  const signature = base64Url(
    crypto
      .createSign("RSA-SHA256")
      .update(`${header}.${claims}`)
      .sign(account.private_key.replace(/\\n/g, "\n"))
  );

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    error_description?: string;
    error?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description || payload.error || "Google token exchange failed"
    );
  }

  return payload.access_token;
}

export async function getOAuthAccessToken(credentials: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    error_description?: string;
    error?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description || payload.error || "Google OAuth refresh failed"
    );
  }

  return payload.access_token;
}
