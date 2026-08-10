import { google } from "googleapis";

// Taken from googleapis' own bundled google-auth-library so the client type
// always matches the one the API constructors accept.
type ImpersonatedJwt = InstanceType<typeof google.auth.JWT>;

/**
 * Google Workspace integration is backed by a single service account with
 * domain-wide delegation. Every call impersonates a specific @jaro.dev mailbox,
 * so no per-user OAuth flow is needed.
 *
 * Required env:
 * - GOOGLE_SERVICE_ACCOUNT_JSON: the full service account key JSON (single line)
 * - GOOGLE_WORKSPACE_DOMAIN: e.g. "jaro.dev"
 */

export const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
];

export const GMAIL_SEND_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export const DIRECTORY_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user.readonly",
];

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  project_id?: string;
}

let cachedKey: ServiceAccountKey | null = null;

export function getWorkspaceDomain(): string {
  return process.env.GOOGLE_WORKSPACE_DOMAIN || "jaro.dev";
}

/** True when the mailbox belongs to the delegated Workspace domain. */
export function isWorkspaceMailbox(email: string): boolean {
  return email.toLowerCase().trim().endsWith(`@${getWorkspaceDomain()}`);
}

/**
 * Parses the service account key from env. Accepts raw JSON or base64-encoded
 * JSON, since some hosts mangle multi-line secrets.
 */
export function getServiceAccountKey(): ServiceAccountKey | null {
  if (cachedKey) return cachedKey;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    const json = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");

    const parsed = JSON.parse(json) as ServiceAccountKey;

    if (!parsed.client_email || !parsed.private_key) {
      console.error(
        "[Google Auth] service account JSON is missing client_email or private_key"
      );
      return null;
    }

    // Escaped newlines survive most env plumbing but break the PEM parser
    cachedKey = {
      ...parsed,
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };

    return cachedKey;
  } catch (error) {
    console.error("[Google Auth] failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:", error);
    return null;
  }
}

export function isGoogleWorkspaceConfigured(): boolean {
  return getServiceAccountKey() !== null;
}

/**
 * Builds a JWT client that impersonates `subject` for the given scopes.
 * Returns null when credentials are not configured, so callers can degrade
 * gracefully instead of throwing at import time.
 */
export function getImpersonatedClient(
  subject: string,
  scopes: string[]
): ImpersonatedJwt | null {
  const key = getServiceAccountKey();
  if (!key) {
    console.error(
      "[Google Auth] GOOGLE_SERVICE_ACCOUNT_JSON is not configured; cannot impersonate"
    );
    return null;
  }

  if (!isWorkspaceMailbox(subject)) {
    console.error(
      `[Google Auth] refusing to impersonate ${subject}: not on @${getWorkspaceDomain()}`
    );
    return null;
  }

  return new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes,
    subject,
  });
}

/**
 * Verifies that delegation actually works for a mailbox by minting a token.
 * Used by the integrations UI and setup checks.
 */
export async function verifyDelegation(
  subject: string,
  scopes: string[]
): Promise<{ data: { ok: true } | null; error: string | null }> {
  try {
    const client = getImpersonatedClient(subject, scopes);
    if (!client) {
      return { data: null, error: "Google service account is not configured" };
    }

    console.log(`[Google Auth] verifying delegation for ${subject}...`);
    await client.authorize();
    console.log(`[Google Auth] delegation verified for ${subject}`);

    return { data: { ok: true }, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Google Auth] delegation failed for ${subject}:`, message);
    return { data: null, error: message };
  }
}
