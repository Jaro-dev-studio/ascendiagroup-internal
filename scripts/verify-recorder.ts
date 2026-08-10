import prisma from "../lib/prisma";
import {
  CALENDAR_SCOPES,
  getWorkspaceDomain,
  isGoogleWorkspaceConfigured,
  verifyDelegation,
} from "../lib/integrations/google-auth";
import { listCalendarEvents } from "../lib/integrations/google-calendar";
import { getRecallRegion, isRecallConfigured } from "../lib/integrations/recall";

/**
 * Exercises the Google Calendar and Recall.ai endpoints the recorder depends on
 * and reports whether each one really answers, so a missing scope or a wrong
 * region is caught before a live meeting relies on it.
 *
 * Usage: pnpm tsx scripts/verify-recorder.ts [calendar@jaro.dev]
 */

const results: Array<{ name: string; ok: boolean; detail: string }> = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${detail}`);
}

async function checkRecall(): Promise<void> {
  if (!isRecallConfigured()) {
    record("Recall API key", false, "RECALL_API_KEY is not set");
    return;
  }

  const region = getRecallRegion();
  const url = `https://${region}.recall.ai/api/v1/bot/?limit=1`;

  console.log(`[Verify] GET ${url}`);
  const response = await fetch(url, {
    headers: {
      Authorization: `Token ${process.env.RECALL_API_KEY}`,
      Accept: "application/json",
    },
  });

  const body = await response.text();

  record(
    `Recall GET /bot/ (${region})`,
    response.ok,
    response.ok
      ? `${response.status}, ${body.slice(0, 120)}`
      : `${response.status} ${body.slice(0, 200)}`
  );
}

async function checkGoogle(explicitCalendar: string | null): Promise<void> {
  if (!isGoogleWorkspaceConfigured()) {
    record(
      "Google service account",
      false,
      "GOOGLE_SERVICE_ACCOUNT_JSON is not set"
    );
    return;
  }

  record(
    "Google service account",
    true,
    `parsed, domain @${getWorkspaceDomain()}`
  );

  const calendars = explicitCalendar
    ? [explicitCalendar]
    : (
      await prisma.recordingRule.findMany({
        select: { calendarEmail: true },
        orderBy: { calendarEmail: "asc" },
      })
    ).map((rule) => rule.calendarEmail);

  if (calendars.length === 0) {
    record(
      "Calendar delegation",
      false,
      "no recording rules exist and no calendar was passed as an argument"
    );
    return;
  }

  for (const calendarEmail of calendars) {
    const delegation = await verifyDelegation(calendarEmail, CALENDAR_SCOPES);
    record(
      `Delegation for ${calendarEmail}`,
      delegation.data !== null,
      delegation.error ?? "token minted"
    );

    if (!delegation.data) continue;

    const now = new Date();
    const events = await listCalendarEvents({
      calendarEmail,
      syncToken: null,
      windowStart: now,
      windowEnd: new Date(now.getTime() + 14 * 86_400_000),
    });

    record(
      `events.list for ${calendarEmail}`,
      events.data !== null,
      events.data
        ? `${events.data.events.length} events in the next 14 days, ` +
            `${events.data.events.filter((event) => event.meetingUrl).length} with a join link`
        : (events.error ?? "unknown error")
    );
  }
}

async function main() {
  const explicitCalendar = process.argv[2] ?? null;

  console.log("[Verify] checking Recall.ai...");
  await checkRecall();

  console.log("[Verify] checking Google Workspace calendars...");
  await checkGoogle(explicitCalendar);

  const failed = results.filter((result) => !result.ok);
  console.log(
    `\n[Verify] ${results.length - failed.length}/${results.length} checks passed`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[Verify] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
