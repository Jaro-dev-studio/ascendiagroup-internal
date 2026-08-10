import prisma from "@/lib/prisma";
import { getBot, isRecallConfigured } from "@/lib/integrations/recall";
import {
  ingestRecallRecording,
  requestTranscriptForRecording,
} from "@/lib/meetings/recall-ingest";
import {
  applyBotStatus,
  FAILED_BOT_CODES,
  latestBotStatus,
} from "@/lib/meetings/recall-status";

const LOG = "[Recorder Poll]";

/** How far back to keep chasing a bot that never produced a transcript. */
const LOOKBACK_DAYS = 14;

export interface RecorderPollSummary {
  checked: number;
  ingested: number;
  transcriptsRequested: number;
  failed: number;
  stillWaiting: number;
  errors: string[];
}

/**
 * Reconciles every bot we scheduled but never ingested, by reading its state
 * from Recall directly.
 *
 * Webhooks are the fast path, but they depend on a dashboard endpoint that can
 * be missing, disabled after repeated failures, or silently unsubscribed from an
 * event. This poll closes that gap: it reaches the same end state as the webhook
 * using the same ingest functions, so a recording can never be lost simply
 * because a delivery did not arrive.
 */
export async function pollPendingRecordings(): Promise<{
  data: RecorderPollSummary | null;
  error: string | null;
}> {
  const summary: RecorderPollSummary = {
    checked: 0,
    ingested: 0,
    transcriptsRequested: 0,
    failed: 0,
    stillWaiting: 0,
    errors: [],
  };

  try {
    if (!isRecallConfigured()) {
      return { data: null, error: "RECALL_API_KEY is not configured" };
    }

    const now = new Date();
    const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);

    console.log(`${LOG} looking for bots awaiting ingest...`);

    const pending = await prisma.calendarEvent.findMany({
      where: {
        recallBotId: { not: null },
        meetingDbId: null,
        decision: { in: ["SCHEDULED", "RECORDING"] },
        startTime: { gte: since, lte: now },
      },
      select: {
        id: true,
        title: true,
        recallBotId: true,
        botStatus: true,
      },
      orderBy: { startTime: "asc" },
    });

    console.log(`${LOG} ${pending.length} event(s) to reconcile`);

    for (const event of pending) {
      const botId = event.recallBotId;
      if (!botId) continue;

      summary.checked += 1;

      const botResult = await getBot(botId);

      if (!botResult.data) {
        const message = `bot ${botId}: ${botResult.error ?? "not found"}`;
        console.error(`${LOG} ${message}`);
        summary.errors.push(message);
        continue;
      }

      const bot = botResult.data;
      const code = latestBotStatus(bot.status_changes);

      if (code && code !== event.botStatus) {
        await applyBotStatus(botId, code, null);
      }

      if (code && FAILED_BOT_CODES.has(code)) {
        summary.failed += 1;
        continue;
      }

      const recording = bot.recordings?.[0] ?? null;

      if (!recording) {
        summary.stillWaiting += 1;
        continue;
      }

      const hasTranscript = Boolean(
        recording.media_shortcuts?.transcript?.data?.download_url
      );

      if (hasTranscript) {
        console.log(`${LOG} transcript ready for bot ${botId}, ingesting...`);

        const ingest = await ingestRecallRecording({
          botId,
          recordingId: recording.id,
        });

        if (ingest.error) {
          summary.errors.push(`bot ${botId}: ${ingest.error}`);
          continue;
        }

        summary.ingested += 1;
        continue;
      }

      if (recording.status?.code !== "done") {
        summary.stillWaiting += 1;
        continue;
      }

      // Recording finished but no transcript exists yet. This is the step the
      // recording.done webhook would normally trigger.
      const requested = await requestTranscriptForRecording(
        botId,
        recording.id
      );

      if (requested.error) {
        summary.errors.push(`bot ${botId}: ${requested.error}`);
        continue;
      }

      if (requested.data?.requested) {
        summary.transcriptsRequested += 1;
      } else {
        // requestTranscriptForRecording ingests directly when the transcript
        // turned out to be ready already.
        const refreshed = await prisma.calendarEvent.findUnique({
          where: { id: event.id },
          select: { meetingDbId: true },
        });

        if (refreshed?.meetingDbId) {
          summary.ingested += 1;
        } else {
          summary.stillWaiting += 1;
        }
      }
    }

    console.log(
      `${LOG} done: ${summary.ingested} ingested, ${summary.transcriptsRequested} transcript(s) requested, ${summary.stillWaiting} waiting, ${summary.failed} failed`
    );

    return { data: summary, error: null };
  } catch (error) {
    console.error(`${LOG} poll failed:`, error);
    return { data: null, error: "Failed to poll pending recordings" };
  }
}
