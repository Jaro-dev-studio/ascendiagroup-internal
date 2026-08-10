import { Webhook } from "svix";
import prisma from "../lib/prisma";
import { normaliseRecallTranscript } from "../lib/meetings/recall-ingest";
import type { RecallTranscriptEntry } from "../lib/integrations/recall";

/**
 * Exercises /api/webhooks/recall against a running dev server with real
 * signatures, plus the transcript normaliser, so the whole webhook path is
 * proven before a live bot depends on it. Signs with the webhook-* headers our
 * workspace verification secret produces.
 *
 * Usage: pnpm tsx --env-file=.env scripts/tmp-test-recall-webhook.ts
 */

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const ENDPOINT = `${BASE_URL}/api/webhooks/recall`;
const SECRET = process.env.RECALL_WEBHOOK_SECRET;

let failures = 0;

function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${detail}`);
  if (!ok) failures += 1;
}

function sign(payload: unknown): {
  body: string;
  headers: Record<string, string>;
} {
  const body = JSON.stringify(payload);
  const messageId = `msg_${Math.random().toString(36).slice(2, 12)}`;
  const timestamp = new Date();

  const webhook = new Webhook(SECRET as string);
  const signature = webhook.sign(messageId, timestamp, body);

  return {
    body,
    headers: {
      "Content-Type": "application/json",
      "webhook-id": messageId,
      "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "webhook-signature": signature,
    },
  };
}

async function post(
  payload: unknown,
  options: { tamper?: boolean } = {}
): Promise<{ status: number; body: string }> {
  const { body, headers } = sign(payload);

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: options.tamper
      ? { ...headers, "webhook-signature": "v1,invalidsignaturevalue" }
      : headers,
    body,
  });

  return { status: response.status, body: await response.text() };
}

function botStatusPayload(event: string, botId: string, subCode?: string) {
  return {
    event,
    data: {
      data: {
        code: event.replace("bot.", ""),
        sub_code: subCode ?? null,
        updated_at: new Date().toISOString(),
      },
      bot: { id: botId, metadata: {} },
    },
  };
}

function testNormaliser() {
  const entries: RecallTranscriptEntry[] = [
    {
      participant: { id: 1, name: "Jaro Bakker", is_host: true, email: null },
      words: [
        { text: "Hey", start_timestamp: { relative: 1.2 }, end_timestamp: { relative: 1.4 } },
        { text: "there,", start_timestamp: { relative: 1.4 }, end_timestamp: { relative: 1.8 } },
        { text: "thanks", start_timestamp: { relative: 1.8 }, end_timestamp: { relative: 2.2 } },
        { text: "for", start_timestamp: { relative: 2.2 }, end_timestamp: { relative: 2.3 } },
        { text: "joining.", start_timestamp: { relative: 2.3 }, end_timestamp: { relative: 2.9 } },
      ],
    },
    {
      participant: { id: 2, name: "Priya Shah", email: "priya@example.com" },
      words: [
        { text: "Happy", start_timestamp: { relative: 3.1 }, end_timestamp: { relative: 3.4 } },
        { text: "to", start_timestamp: { relative: 3.4 }, end_timestamp: { relative: 3.5 } },
        { text: "be", start_timestamp: { relative: 3.5 }, end_timestamp: { relative: 3.6 } },
        { text: "here.", start_timestamp: { relative: 3.6 }, end_timestamp: { relative: 4.0 } },
      ],
    },
    {
      // Empty entries appear when a participant only produced non-speech audio
      participant: { id: 3, name: "Silent Guest", email: null },
      words: [],
    },
  ];

  const segments = normaliseRecallTranscript(entries);

  check(
    "normaliser drops empty entries",
    segments.length === 2,
    `${segments.length} segments from 3 entries`
  );
  check(
    "normaliser joins words into speech",
    segments[0].speech === "Hey there, thanks for joining.",
    `"${segments[0].speech}"`
  );
  check(
    "normaliser keeps speaker names",
    segments[0].speaker.name === "Jaro Bakker" &&
      segments[1].speaker.name === "Priya Shah",
    `${segments.map((segment) => segment.speaker.name).join(", ")}`
  );
  check(
    "normaliser derives segment timings",
    segments[0].start_time === 1.2 && segments[0].end_time === 2.9,
    `${segments[0].start_time} -> ${segments[0].end_time}`
  );
}

async function main() {
  if (!SECRET) {
    console.error("RECALL_WEBHOOK_SECRET must be set to run this test");
    process.exitCode = 1;
    return;
  }

  console.log("--- transcript normaliser ---");
  testNormaliser();

  console.log(`\n--- webhook endpoint (${ENDPOINT}) ---`);

  const unsigned = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "bot.done", data: {} }),
  });
  check(
    "rejects requests with no signature",
    unsigned.status === 401,
    `HTTP ${unsigned.status}`
  );

  const tampered = await post(botStatusPayload("bot.done", "bot_fake"), {
    tamper: true,
  });
  check(
    "rejects a tampered signature",
    tampered.status === 401,
    `HTTP ${tampered.status}`
  );

  // A bot id that matches nothing must still be acknowledged, otherwise Recall
  // retries the delivery for 24 hours.
  const unknownBot = await post(botStatusPayload("bot.joining_call", "bot_unknown"));
  check(
    "accepts a signed event for an unknown bot",
    unknownBot.status === 200,
    `HTTP ${unknownBot.status} ${unknownBot.body}`
  );

  const noBot = await post({ event: "recording.deleted", data: {} });
  check(
    "ignores events without a bot",
    noBot.status === 200,
    `HTTP ${noBot.status} ${noBot.body}`
  );

  // Now prove the status handler actually writes to a matching CalendarEvent
  const botId = `bot_test_${Date.now()}`;
  const rule = await prisma.recordingRule.findFirst({ select: { id: true } });

  const event = await prisma.calendarEvent.create({
    data: {
      googleEventId: `test-event-${Date.now()}`,
      calendarEmail: "webhook-test@jaro.dev",
      title: "Webhook signature test",
      startTime: new Date(Date.now() + 3_600_000),
      endTime: new Date(Date.now() + 5_400_000),
      attendees: ["webhook-test@jaro.dev", "guest@example.com"],
      meetingUrl: "https://meet.google.com/webhook-test",
      platform: "google_meet",
      decision: "SCHEDULED",
      recallBotId: botId,
      botScheduledFor: new Date(Date.now() + 3_500_000),
      ruleId: rule?.id ?? null,
    },
    select: { id: true },
  });

  try {
    const recording = await post(
      botStatusPayload("bot.in_call_recording", botId)
    );
    check(
      "accepts bot.in_call_recording",
      recording.status === 200,
      `HTTP ${recording.status} ${recording.body}`
    );

    const afterRecording = await prisma.calendarEvent.findUnique({
      where: { id: event.id },
      select: { decision: true, botStatus: true },
    });
    check(
      "marks the event as RECORDING",
      afterRecording?.decision === "RECORDING" &&
        afterRecording?.botStatus === "in_call_recording",
      `decision=${afterRecording?.decision} botStatus=${afterRecording?.botStatus}`
    );

    const fatal = await post(
      botStatusPayload("bot.fatal", botId, "meeting_link_invalid")
    );
    check("accepts bot.fatal", fatal.status === 200, `HTTP ${fatal.status}`);

    const afterFatal = await prisma.calendarEvent.findUnique({
      where: { id: event.id },
      select: { decision: true, decisionReason: true },
    });
    check(
      "records the failure reason",
      afterFatal?.decision === "FAILED" &&
        Boolean(afterFatal?.decisionReason?.includes("meeting_link_invalid")),
      `decision=${afterFatal?.decision} reason=${afterFatal?.decisionReason}`
    );

    const transcriptFailed = await post({
      event: "transcript.failed",
      data: {
        data: {
          code: "failed",
          sub_code: "provider_connection_failed",
          updated_at: new Date().toISOString(),
        },
        transcript: { id: "tr_test", metadata: {} },
        recording: { id: "rec_test", metadata: {} },
        bot: { id: botId, metadata: {} },
      },
    });
    check(
      "accepts transcript.failed",
      transcriptFailed.status === 200,
      `HTTP ${transcriptFailed.status}`
    );

    const afterTranscriptFailure = await prisma.calendarEvent.findUnique({
      where: { id: event.id },
      select: { decisionReason: true },
    });
    check(
      "records the transcript failure sub code",
      Boolean(
        afterTranscriptFailure?.decisionReason?.includes(
          "provider_connection_failed"
        )
      ),
      `${afterTranscriptFailure?.decisionReason}`
    );
  } finally {
    await prisma.calendarEvent.delete({ where: { id: event.id } });
    console.log("\ncleaned up the test calendar event");
  }

  console.log(
    failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("TEST FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
