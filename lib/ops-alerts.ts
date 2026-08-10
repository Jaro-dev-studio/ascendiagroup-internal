import { createHash } from "crypto";
import type { OpsAlertSeverity } from "@prisma/client";
import prisma from "@/lib/prisma";
import { SLACK_OPERATIONS_CHANNEL_ID } from "@/lib/constants";
import { sendSlackMessage } from "@/lib/slack-client";

const LOG = "[OpsAlerts]";

/**
 * Operational failure reporting for unattended work.
 *
 * Cron jobs, webhooks and outbound email run with nobody watching, so every
 * failure is posted to the operations Slack channel. A failure that repeats on
 * every tick is posted once per re-notify window and then counted, which is
 * what keeps a broken integration from burying the channel.
 */

/** How long a fingerprint stays quiet after being posted. */
const RENOTIFY_AFTER_MS = 60 * 60 * 1000;

/** Slack truncates blocks past 3000 characters, so long values are trimmed. */
const MAX_FIELD_LENGTH = 900;
const MAX_DETAIL_LINES = 10;

export type OpsAlertContext = Record<
  string,
  string | number | boolean | null | undefined
>;

export interface OpsAlertInput {
  /** Where the failure happened, e.g. "Cron: sync-emails". */
  source: string;
  /** One line describing what failed. */
  summary: string;
  error?: unknown;
  /** Extra key/value pairs rendered as Slack fields. */
  context?: OpsAlertContext;
  /** Per-item failures, for a run that partially succeeded. */
  details?: string[];
  /** Defaults to CRITICAL; use WARNING when the run itself completed. */
  severity?: OpsAlertSeverity;
  /** Dashboard page to link to. Relative paths are resolved against the app URL. */
  url?: string;
  /**
   * Overrides what makes this alert distinct. Defaults to the summary, which
   * is right whenever the summary does not carry a per-item id.
   */
  dedupeKey?: string;
}

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://studio.jaro.dev"
  ).replace(/\/$/, "");
}

export function toErrorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Strips the parts of a message that change between occurrences (counts, ids,
 * timestamps) so "3 of 40 failed" and "5 of 40 failed" collapse onto one row.
 */
function normalizeForFingerprint(value: string): string {
  return value
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>")
    .replace(/\bc[a-z0-9]{24}\b/g, "<id>")
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFingerprint(input: OpsAlertInput, errorMessage: string): string {
  const seed = [
    input.source,
    normalizeForFingerprint(input.dedupeKey ?? input.summary),
    normalizeForFingerprint(errorMessage),
  ].join("|");

  return createHash("sha1").update(seed).digest("hex");
}

function truncate(value: string, limit = MAX_FIELD_LENGTH): string {
  return value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;
}

function severityEmoji(severity: OpsAlertSeverity): string {
  return severity === "CRITICAL" ? "🔴" : "🟠";
}

function buildBlocks(
  input: OpsAlertInput,
  errorMessage: string | null,
  severity: OpsAlertSeverity,
  occurrences: number
): unknown[] {
  const blocks: unknown[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${severityEmoji(severity)} *${severity === "CRITICAL" ? "Failure" : "Partial failure"}: ${input.source}*\n${truncate(input.summary)}`,
      },
    },
  ];

  if (errorMessage) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Error*\n\`\`\`${truncate(errorMessage)}\`\`\`` },
    });
  }

  const contextEntries = Object.entries(input.context ?? {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );

  if (contextEntries.length > 0) {
    blocks.push({
      type: "section",
      fields: contextEntries.slice(0, 10).map(([key, value]) => ({
        type: "mrkdwn",
        text: `*${key}:*\n${truncate(String(value), 200)}`,
      })),
    });
  }

  if (input.details && input.details.length > 0) {
    const shown = input.details.slice(0, MAX_DETAIL_LINES);
    const remaining = input.details.length - shown.length;
    const lines = shown.map((detail) => `• ${truncate(detail, 200)}`).join("\n");

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Details*\n${lines}${remaining > 0 ? `\n_…and ${remaining} more_` : ""}`,
      },
    });
  }

  const contextLines = [
    occurrences > 1
      ? `Seen ${occurrences} times — repeats are muted for ${RENOTIFY_AFTER_MS / 60000} minutes`
      : null,
    new Date().toISOString(),
  ].filter(Boolean);

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: contextLines.join(" · ") }],
  });

  if (input.url) {
    const href = input.url.startsWith("http")
      ? input.url
      : `${getBaseUrl()}${input.url}`;

    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open in Studio", emoji: true },
          url: href,
        },
      ],
    });
  }

  return blocks;
}

/**
 * Records a failure and posts it to the operations channel.
 *
 * Never throws and never rejects: callers report failures from inside their own
 * catch blocks, so this must not be able to mask the original error.
 */
export async function reportOpsFailure(input: OpsAlertInput): Promise<void> {
  const severity = input.severity ?? "CRITICAL";
  const errorMessage = input.error ? toErrorMessage(input.error) : null;

  console.error(
    `${LOG} ${severity} in ${input.source}: ${input.summary}${errorMessage ? ` — ${errorMessage}` : ""}`
  );

  try {
    const fingerprint = buildFingerprint(input, errorMessage ?? "");
    const now = new Date();

    console.log(`${LOG} recording alert ${fingerprint.slice(0, 8)}...`);

    const existing = await prisma.opsAlert.findUnique({
      where: { fingerprint },
      select: { occurrences: true, lastNotifiedAt: true },
    });

    const occurrences = (existing?.occurrences ?? 0) + 1;
    const isMuted = Boolean(
      existing?.lastNotifiedAt &&
        now.getTime() - existing.lastNotifiedAt.getTime() < RENOTIFY_AFTER_MS
    );

    if (isMuted) {
      console.log(
        `${LOG} alert already posted within the re-notify window; counting occurrence ${occurrences}`
      );
      await prisma.opsAlert.update({
        where: { fingerprint },
        data: { occurrences, lastSeenAt: now, summary: input.summary },
      });
      return;
    }

    console.log(`${LOG} posting alert to the operations channel...`);

    const posted = await sendSlackMessage({
      channel: SLACK_OPERATIONS_CHANNEL_ID,
      text: `${severityEmoji(severity)} ${input.source}: ${input.summary}`,
      blocks: buildBlocks(input, errorMessage, severity, occurrences),
    });

    await prisma.opsAlert.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        source: input.source,
        severity,
        summary: input.summary,
        errorMessage,
        context: input.context ? (input.context as object) : undefined,
        lastNotifiedAt: posted ? now : null,
      },
      update: {
        severity,
        summary: input.summary,
        errorMessage,
        context: input.context ? (input.context as object) : undefined,
        occurrences,
        lastSeenAt: now,
        ...(posted ? { lastNotifiedAt: now } : {}),
      },
    });

    if (!posted) {
      console.error(`${LOG} Slack delivery failed; alert recorded only`);
    }
  } catch (error) {
    // Reporting must never become the reason a request fails
    console.error(`${LOG} could not record alert:`, toErrorMessage(error));
  }
}
