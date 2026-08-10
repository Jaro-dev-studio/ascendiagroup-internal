import prisma from "@/lib/prisma";
import { processRecording } from "@/lib/meetings/process-recording";
import {
  createAsyncTranscript,
  downloadTranscript,
  getBot,
  getRecording,
  getTranscript,
  type RecallBot,
  type RecallTranscriptEntry,
} from "@/lib/integrations/recall";
import type { TranscriptSegment } from "@/lib/meetings/transcript";

const LOG = "[Recall Ingest]";

/**
 * Turns Recall's word-level transcript into the speaker segments the rest of the
 * meeting pipeline already understands.
 */
export function normaliseRecallTranscript(
  entries: RecallTranscriptEntry[]
): TranscriptSegment[] {
  return entries
    .map((entry) => {
      const words = entry.words ?? [];
      const speech = words
        .map((word) => word.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (!speech) return null;

      const starts = words
        .map((word) => word.start_timestamp?.relative)
        .filter((value): value is number => typeof value === "number");
      const ends = words
        .map((word) => word.end_timestamp?.relative)
        .filter((value): value is number => typeof value === "number");

      return {
        speech,
        start_time: starts.length > 0 ? Math.min(...starts) : 0,
        end_time: ends.length > 0 ? Math.max(...ends) : 0,
        speaker: { name: entry.participant?.name || "Unknown" },
      };
    })
    .filter((segment): segment is TranscriptSegment => segment !== null)
    .sort((a, b) => a.start_time - b.start_time);
}

/** Derives the call window from the bot's own status history. */
function deriveTimesFromBot(bot: RecallBot): { start: Date | null; end: Date | null } {
  const changes = bot.status_changes ?? [];
  const startCodes = ["in_call_recording", "in_call_not_recording", "joining_call"];
  const endCodes = ["call_ended", "done", "fatal"];

  const start = changes.find((change) => startCodes.includes(change.code));
  const end = [...changes].reverse().find((change) => endCodes.includes(change.code));

  return {
    start: start ? new Date(start.created_at) : null,
    end: end ? new Date(end.created_at) : null,
  };
}

export interface IngestRecallInput {
  botId: string;
  recordingId?: string | null;
  transcriptId?: string | null;
}

/**
 * Fetches a finished Recall recording, normalises its transcript and hands it to
 * the shared meeting processor, then marks the originating CalendarEvent done.
 *
 * Safe to call more than once for the same bot: the CalendarEvent link and the
 * processor's own identity check both short-circuit repeats.
 */
export async function ingestRecallRecording(
  input: IngestRecallInput
): Promise<{
  data: { meetingId: string; skipped: boolean } | null;
  error: string | null;
}> {
  try {
    console.log(`${LOG} ingesting bot ${input.botId}...`);

    const calendarEvent = await prisma.calendarEvent.findUnique({
      where: { recallBotId: input.botId },
      select: {
        id: true,
        googleEventId: true,
        title: true,
        description: true,
        startTime: true,
        endTime: true,
        attendees: true,
        calendarEmail: true,
        meetingDbId: true,
      },
    });

    if (calendarEvent?.meetingDbId) {
      console.log(
        `${LOG} bot ${input.botId} already produced meeting ${calendarEvent.meetingDbId}, skipping`
      );
      return {
        data: { meetingId: calendarEvent.meetingDbId, skipped: true },
        error: null,
      };
    }

    console.log(`${LOG} fetching bot ${input.botId}...`);
    const botResult = await getBot(input.botId);
    if (!botResult.data) {
      return { data: null, error: botResult.error ?? "Bot not found" };
    }
    const bot = botResult.data;

    const recordingId =
      input.recordingId ?? bot.recordings?.[0]?.id ?? null;

    if (!recordingId) {
      return { data: null, error: "Bot has no recording" };
    }

    console.log(`${LOG} resolving transcript for recording ${recordingId}...`);

    let downloadUrl: string | null = null;

    if (input.transcriptId) {
      const transcript = await getTranscript(input.transcriptId);
      downloadUrl = transcript.data?.data?.download_url ?? null;
    }

    if (!downloadUrl) {
      const recording = await getRecording(recordingId);
      downloadUrl =
        recording.data?.media_shortcuts?.transcript?.data?.download_url ?? null;
    }

    if (!downloadUrl) {
      return {
        data: null,
        error: `No transcript download URL available for recording ${recordingId}`,
      };
    }

    const transcriptJson = await downloadTranscript(downloadUrl);
    if (!transcriptJson.data) {
      return {
        data: null,
        error: transcriptJson.error ?? "Failed to download transcript",
      };
    }

    const segments = normaliseRecallTranscript(transcriptJson.data);
    console.log(`${LOG} normalised ${segments.length} transcript segments`);

    // Calendar attendees are the reliable source of participant emails; Recall
    // only exposes emails for platforms that publish them.
    const transcriptEmails = transcriptJson.data
      .map((entry) => entry.participant?.email)
      .filter((email): email is string => Boolean(email));

    const participantEmails = Array.from(
      new Set(
        [...(calendarEvent?.attendees ?? []), ...transcriptEmails].map((email) =>
          email.toLowerCase()
        )
      )
    );

    const botTimes = deriveTimesFromBot(bot);
    const startTime = calendarEvent?.startTime ?? botTimes.start ?? new Date();
    const endTime = calendarEvent?.endTime ?? botTimes.end ?? new Date();

    const videoUrl =
      bot.recordings?.[0]?.media_shortcuts?.video_mixed?.data?.download_url ??
      null;

    const result = await processRecording({
      provider: "RECALL",
      meetingId: calendarEvent?.googleEventId ?? input.botId,
      callRecordingId: recordingId,
      title: calendarEvent?.title ?? bot.bot_name ?? "Untitled meeting",
      description: calendarEvent?.description ?? null,
      startTime,
      endTime,
      participantEmails,
      transcript: segments,
      recordingUrl: videoUrl,
    });

    if (!result.data) {
      return { data: null, error: result.error };
    }

    if (calendarEvent) {
      await prisma.calendarEvent.update({
        where: { id: calendarEvent.id },
        data: {
          decision: "COMPLETED",
          botStatus: "done",
          meetingDbId: result.data.meetingId,
        },
      });
    }

    console.log(
      `${LOG} bot ${input.botId} ingested as meeting ${result.data.meetingId}`
    );

    return { data: result.data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} ingest failed for bot ${input.botId}:`, message);
    return { data: null, error: message };
  }
}

/**
 * Requests post-meeting transcription once the recording is available. Bots are
 * created without a transcription provider so we only pay for calls that
 * actually produced a recording.
 */
export async function requestTranscriptForRecording(
  botId: string,
  recordingId: string
): Promise<{ data: { requested: boolean } | null; error: string | null }> {
  console.log(`${LOG} recording ${recordingId} done, requesting transcript...`);

  const recording = await getRecording(recordingId);
  const existing = recording.data?.media_shortcuts?.transcript;

  if (existing?.status?.code === "done" && existing.data?.download_url) {
    console.log(`${LOG} transcript already available, ingesting directly`);
    const ingest = await ingestRecallRecording({ botId, recordingId });
    return {
      data: { requested: false },
      error: ingest.error,
    };
  }

  if (existing?.id) {
    console.log(`${LOG} transcript ${existing.id} is already in progress`);
    return { data: { requested: false }, error: null };
  }

  const created = await createAsyncTranscript(recordingId);
  if (!created.data) {
    return { data: null, error: created.error };
  }

  await prisma.calendarEvent.updateMany({
    where: { recallBotId: botId },
    data: { botStatus: "transcribing" },
  });

  return { data: { requested: true }, error: null };
}
