/**
 * Posts a real alert to the operations Slack channel and checks the throttling
 * that keeps a recurring failure from flooding it.
 *
 * Run this after changing the channel, the bot token or the alert format, so a
 * broken alerting path shows up here rather than during the outage it was meant
 * to report.
 *
 * Usage: pnpm ops:verify
 */

function record(name: string, ok: boolean, detail: string): boolean {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${detail}`);
  return ok;
}

async function main(): Promise<void> {
  const results: boolean[] = [];

  const { reportOpsFailure } = await import("../lib/ops-alerts");
  const { SLACK_OPERATIONS_CHANNEL_ID } = await import("../lib/constants");
  const prisma = (await import("../lib/prisma")).default;

  // A unique run id keeps each verification on its own fingerprint, so this
  // never mutes a real alert or gets muted by a previous run.
  const runId = Date.now().toString(36);
  const source = `Verification (${runId})`;

  console.log(`[Verify] channel ${SLACK_OPERATIONS_CHANNEL_ID}, source "${source}"\n`);

  const channel = await fetch(
    `https://slack.com/api/conversations.info?channel=${SLACK_OPERATIONS_CHANNEL_ID}`,
    { headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` } }
  ).then((response) => response.json());

  results.push(
    record(
      "Bot can see the operations channel",
      channel.ok === true && channel.channel?.is_member === true,
      channel.ok
        ? `#${channel.channel?.name} (member=${channel.channel?.is_member})`
        : `Slack said "${channel.error}"`
    )
  );

  await reportOpsFailure({
    source,
    summary: "Test alert from pnpm ops:verify — safe to ignore",
    error: new Error("Simulated failure used to verify operational alerting"),
    context: { runId, triggeredBy: "verify-ops-alerts" },
    details: ["First example item that failed", "Second example item that failed"],
    url: "/dashboard/submissions",
  });

  const posted = await prisma.opsAlert.findFirst({ where: { source } });

  results.push(
    record(
      "Alert reaches Slack and is recorded",
      Boolean(posted?.lastNotifiedAt),
      posted
        ? `occurrences=${posted.occurrences}, notified=${posted.lastNotifiedAt?.toISOString() ?? "never"}`
        : "no OpsAlert row was written"
    )
  );

  // The same failure again must be counted rather than posted a second time
  await reportOpsFailure({
    source,
    summary: "Test alert from pnpm ops:verify — safe to ignore",
    error: new Error("Simulated failure used to verify operational alerting"),
    context: { runId, triggeredBy: "verify-ops-alerts" },
  });

  const repeated = await prisma.opsAlert.findFirst({ where: { source } });

  results.push(
    record(
      "Repeat inside the window is counted, not reposted",
      repeated?.occurrences === 2 &&
        repeated?.lastNotifiedAt?.getTime() === posted?.lastNotifiedAt?.getTime(),
      `occurrences=${repeated?.occurrences}, notified unchanged=${
        repeated?.lastNotifiedAt?.getTime() === posted?.lastNotifiedAt?.getTime()
      }`
    )
  );

  await prisma.opsAlert.deleteMany({ where: { source } });
  console.log(`\n[Verify] removed the test alert row(s) for "${source}"`);

  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  console.log(
    failed === 0
      ? "Check the operations channel: exactly one test alert should be there."
      : "Alerting is not fully working; see the failures above."
  );

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("[Verify] ops alert verification failed:", error);
  process.exit(1);
});
