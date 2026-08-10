import crypto from "crypto";

/**
 * Variable rendering and tracking rewrites for sequence emails.
 *
 * Variables use {{name}} and fall back to a supplied default with
 * {{name|fallback}}, so a missing first name degrades to "there" rather than
 * shipping an empty greeting.
 */

export interface RenderContext {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  senderName?: string | null;
  senderFirstName?: string | null;
}

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}/g;

export const AVAILABLE_VARIABLES = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "jobTitle",
  "companyName",
  "senderName",
  "senderFirstName",
] as const;

export function renderTemplate(
  template: string,
  context: RenderContext
): string {
  return template.replace(VARIABLE_PATTERN, (_match, name: string, fallback?: string) => {
    const value = context[name as keyof RenderContext];
    if (value) return String(value);
    return fallback ?? "";
  });
}

/** Variables used by a template that the context cannot fill. */
export function findUnresolvedVariables(
  template: string,
  context: RenderContext
): string[] {
  const missing = new Set<string>();

  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const [, name, fallback] = match;
    const known = (AVAILABLE_VARIABLES as readonly string[]).includes(name);
    const filled = Boolean(context[name as keyof RenderContext]);
    if (!known || (!filled && fallback === undefined)) missing.add(name);
  }

  return Array.from(missing);
}

function getSigningSecret(): string {
  return process.env.NEXTAUTH_SECRET || "jaro-dev-sequence-fallback-secret";
}

/**
 * Signed unsubscribe token. Signing means the link works without a database
 * lookup and cannot be used to suppress an arbitrary third party's address.
 */
export function createUnsubscribeToken(email: string): string {
  const normalised = email.toLowerCase().trim();
  const payload = Buffer.from(normalised).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSigningSecret())
    .update(normalised)
    .digest("base64url")
    .slice(0, 24);
  return `${payload}.${signature}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  try {
    const email = Buffer.from(payload, "base64url").toString("utf8");
    const expected = crypto
      .createHmac("sha256", getSigningSecret())
      .update(email)
      .digest("base64url")
      .slice(0, 24);

    // Constant-time compare so the signature cannot be probed byte by byte
    const matches =
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

    return matches ? email : null;
  } catch {
    return null;
  }
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Appends the footer every outbound sequence email must carry. */
export function appendUnsubscribeFooter(
  html: string,
  email: string,
  senderName: string
): string {
  const url = `${getAppUrl()}/api/unsubscribe/${createUnsubscribeToken(email)}`;

  return `${html}
<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e5e5;font-size:12px;color:#8a8a8a;">
  <p style="margin:0;">${senderName} · <a href="${url}" style="color:#8a8a8a;">Unsubscribe</a></p>
</div>`;
}

/** List-Unsubscribe headers, which materially improve inbox placement. */
export function buildUnsubscribeHeaders(email: string): Record<string, string> {
  const url = `${getAppUrl()}/api/unsubscribe/${createUnsubscribeToken(email)}`;
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Transparent 1x1 pixel that records an open when fetched. */
export function appendTrackingPixel(html: string, messageId: string): string {
  const url = `${getAppUrl()}/api/track/open/${messageId}`;
  return `${html}<img src="${url}" width="1" height="1" alt="" style="display:block;border:0;" />`;
}

/**
 * Rewrites http(s) links through the click tracker. Anchors already pointing at
 * our own tracking or unsubscribe endpoints are left alone.
 */
export function rewriteLinksForTracking(
  html: string,
  messageId: string
): string {
  const base = `${getAppUrl()}/api/track/click/${messageId}`;

  return html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (match, url: string) => {
      if (url.includes("/api/track/") || url.includes("/api/unsubscribe/")) {
        return match;
      }
      return `href="${base}?url=${encodeURIComponent(url)}"`;
    }
  );
}
