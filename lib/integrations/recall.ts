const LOG = "[Recall]";

/**
 * Recall.ai client.
 *
 * Everything in Recall is region-scoped: the API key, the verification secret
 * and the base URL must all belong to the same region.
 *
 * Required env:
 * - RECALL_API_KEY
 * - RECALL_REGION: us-east-1 | us-west-2 | eu-central-1 | ap-northeast-1
 */

const VALID_REGIONS = [
  "us-east-1",
  "us-west-2",
  "eu-central-1",
  "ap-northeast-1",
] as const;

export type RecallRegion = (typeof VALID_REGIONS)[number];

/** Scheduled bots must be created at least this far ahead to be guaranteed. */
export const SCHEDULED_BOT_LEAD_MINUTES = 10;

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

export class RecallApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string
  ) {
    super(message);
    this.name = "RecallApiError";
  }
}

export function getRecallRegion(): RecallRegion {
  const region = process.env.RECALL_REGION;
  if (region && (VALID_REGIONS as readonly string[]).includes(region)) {
    return region as RecallRegion;
  }
  return "us-west-2";
}

export function isRecallConfigured(): boolean {
  return Boolean(process.env.RECALL_API_KEY);
}

function getBaseUrl(): string {
  return `https://${getRecallRegion()}.recall.ai/api/v1`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function recallRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const apiKey = process.env.RECALL_API_KEY;
  if (!apiKey) {
    throw new RecallApiError("RECALL_API_KEY is not configured", 0);
  }

  const url = `${getBaseUrl()}${path}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init.headers,
      },
    });

    if (response.ok) {
      if (response.status === 204) return undefined as T;
      const text = await response.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }

    const body = await response.text();

    if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS) {
      const backoffMs = 500 * 2 ** (attempt - 1);
      console.warn(
        `${LOG} ${init.method ?? "GET"} ${path} returned ${response.status}, retrying in ${backoffMs}ms (attempt ${attempt}/${MAX_ATTEMPTS})`
      );
      await sleep(backoffMs);
      continue;
    }

    throw new RecallApiError(
      `${init.method ?? "GET"} ${path} failed with ${response.status}`,
      response.status,
      body
    );
  }

  throw new RecallApiError(
    `${init.method ?? "GET"} ${path} exhausted retries`,
    0
  );
}

export interface RecallBot {
  id: string;
  bot_name?: string;
  join_at?: string | null;
  meeting_url?: unknown;
  status_changes?: Array<{ code: string; created_at: string }>;
  recordings?: Array<{
    id: string;
    status?: { code: string };
    media_shortcuts?: {
      transcript?: { data?: { download_url?: string | null } };
      video_mixed?: { data?: { download_url?: string | null } };
    };
  }>;
  metadata?: Record<string, string>;
}

export interface ScheduleBotInput {
  meetingUrl: string;
  /**
   * Omit to create an ad-hoc bot that joins right away. Recall only guarantees
   * on-time joins for bots created 10+ minutes ahead of `join_at`.
   */
  joinAt?: Date | null;
  botName: string;
  /** Copied onto the bot so webhooks can be traced back to our CalendarEvent. */
  metadata?: Record<string, string>;
  announceInChat?: boolean;
}

/**
 * Schedules a bot to join a call. Transcription is requested as a post-meeting
 * job from the webhook rather than in real time, so no transcript provider is
 * configured here.
 */
export async function scheduleBot(
  input: ScheduleBotInput
): Promise<{ data: RecallBot | null; error: string | null }> {
  try {
    console.log(
      `${LOG} scheduling bot "${input.botName}" for ${input.joinAt ? input.joinAt.toISOString() : "immediate join"} on ${input.meetingUrl}`
    );

    const bot = await recallRequest<RecallBot>("/bot/", {
      method: "POST",
      body: JSON.stringify({
        meeting_url: input.meetingUrl,
        ...(input.joinAt ? { join_at: input.joinAt.toISOString() } : {}),
        bot_name: input.botName,
        metadata: input.metadata,
        ...(input.announceInChat
          ? {
            chat: {
              on_bot_join: {
                send_to: "everyone",
                message: "This meeting is being recorded and transcribed.",
                pin: true,
              },
            },
          }
          : {}),
      }),
    });

    console.log(`${LOG} scheduled bot ${bot.id}`);
    return { data: bot, error: null };
  } catch (error) {
    // Recall keeps a limited pool of warm bots for immediate joins and returns
    // 507 while it is empty, which is recoverable by trying again shortly.
    if (error instanceof RecallApiError && error.status === 507) {
      console.error(`${LOG} ad-hoc bot pool is empty`);
      return {
        data: null,
        error:
          "No recorder is free right now. Try again in about 30 seconds.",
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} failed to schedule bot:`, message);
    return { data: null, error: message };
  }
}

/** Moves a scheduled bot's join time. Only works before the bot joins. */
export async function rescheduleBot(
  botId: string,
  joinAt: Date
): Promise<{ data: RecallBot | null; error: string | null }> {
  try {
    console.log(`${LOG} rescheduling bot ${botId} to ${joinAt.toISOString()}`);

    const bot = await recallRequest<RecallBot>(`/bot/${botId}/`, {
      method: "PATCH",
      body: JSON.stringify({ join_at: joinAt.toISOString() }),
    });

    return { data: bot, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} failed to reschedule bot ${botId}:`, message);
    return { data: null, error: message };
  }
}

/**
 * Cancels a scheduled bot. A 404 or 405 means the bot is already gone or has
 * joined, which is treated as success so callers stay idempotent.
 */
export async function cancelBot(
  botId: string
): Promise<{ data: { cancelled: boolean } | null; error: string | null }> {
  try {
    console.log(`${LOG} cancelling bot ${botId}...`);
    await recallRequest<void>(`/bot/${botId}/`, { method: "DELETE" });
    return { data: { cancelled: true }, error: null };
  } catch (error) {
    if (
      error instanceof RecallApiError &&
      (error.status === 404 || error.status === 405)
    ) {
      console.log(
        `${LOG} bot ${botId} could not be deleted (${error.status}); treating as already gone`
      );
      return { data: { cancelled: false }, error: null };
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} failed to cancel bot ${botId}:`, message);
    return { data: null, error: message };
  }
}

/**
 * Pulls a bot out of a call it has already joined. Deleting only works before
 * the bot is dispatched, so this is the counterpart for live bots. Irreversible.
 */
export async function removeBotFromCall(
  botId: string
): Promise<{ data: { removed: boolean } | null; error: string | null }> {
  try {
    console.log(`${LOG} removing bot ${botId} from its call...`);
    await recallRequest<RecallBot>(`/bot/${botId}/leave_call/`, {
      method: "POST",
    });
    return { data: { removed: true }, error: null };
  } catch (error) {
    // A bot that never joined, or has already left, cannot be removed again.
    if (
      error instanceof RecallApiError &&
      (error.status === 400 || error.status === 404)
    ) {
      console.log(
        `${LOG} bot ${botId} is not in a call (${error.status}); treating as already gone`
      );
      return { data: { removed: false }, error: null };
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} failed to remove bot ${botId} from call:`, message);
    return { data: null, error: message };
  }
}

/**
 * Stops a bot whichever stage it is at. Deleting only works before dispatch, so
 * a bot that is live, or that joined since the last status we saw, is asked to
 * leave the call instead.
 */
export async function stopBot(
  botId: string,
  isLive: boolean
): Promise<{ data: { stopped: boolean } | null; error: string | null }> {
  if (!isLive) {
    const cancelled = await cancelBot(botId);
    if (!cancelled.data) return { data: null, error: cancelled.error };
    if (cancelled.data.cancelled) {
      return { data: { stopped: true }, error: null };
    }
  }

  const removed = await removeBotFromCall(botId);
  if (!removed.data) return { data: null, error: removed.error };

  return { data: { stopped: removed.data.removed }, error: null };
}

export async function getBot(
  botId: string
): Promise<{ data: RecallBot | null; error: string | null }> {
  try {
    const bot = await recallRequest<RecallBot>(`/bot/${botId}/`);
    return { data: bot, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} failed to fetch bot ${botId}:`, message);
    return { data: null, error: message };
  }
}

export interface RecallRecording {
  id: string;
  bot?: { id: string } | null;
  started_at?: string | null;
  completed_at?: string | null;
  expires_at?: string | null;
  media_shortcuts?: {
    transcript?: {
      id?: string;
      status?: { code: string };
      data?: { download_url?: string | null };
    };
    video_mixed?: { data?: { download_url?: string | null } };
  };
}

export async function getRecording(
  recordingId: string
): Promise<{ data: RecallRecording | null; error: string | null }> {
  try {
    const recording = await recallRequest<RecallRecording>(
      `/recording/${recordingId}/`
    );
    return { data: recording, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} failed to fetch recording ${recordingId}:`, message);
    return { data: null, error: message };
  }
}

/** Kicks off post-meeting transcription with Recall's own transcription provider. */
export async function createAsyncTranscript(
  recordingId: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    console.log(`${LOG} requesting async transcript for recording ${recordingId}...`);

    const transcript = await recallRequest<{ id: string }>(
      `/recording/${recordingId}/create_transcript/`,
      {
        method: "POST",
        body: JSON.stringify({
          provider: { recallai_async: { language_code: "auto" } },
          diarization: { use_separate_streams_when_available: true },
        }),
      }
    );

    return { data: transcript, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `${LOG} failed to request transcript for ${recordingId}:`,
      message
    );
    return { data: null, error: message };
  }
}

export interface RecallTranscript {
  id: string;
  recording_id?: string;
  status?: { code: string };
  data?: { download_url?: string | null };
}

export async function getTranscript(
  transcriptId: string
): Promise<{ data: RecallTranscript | null; error: string | null }> {
  try {
    const transcript = await recallRequest<RecallTranscript>(
      `/transcript/${transcriptId}/`
    );
    return { data: transcript, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} failed to fetch transcript ${transcriptId}:`, message);
    return { data: null, error: message };
  }
}

/** Shape of the JSON behind a transcript download URL. */
export interface RecallTranscriptParticipant {
  id: number;
  name: string | null;
  is_host?: boolean | null;
  email?: string | null;
}

export interface RecallTranscriptEntry {
  participant: RecallTranscriptParticipant;
  language_code?: string;
  words: Array<{
    text: string;
    start_timestamp?: { relative?: number | null } | null;
    end_timestamp?: { relative?: number | null } | null;
  }>;
}

export async function downloadTranscript(
  downloadUrl: string
): Promise<{ data: RecallTranscriptEntry[] | null; error: string | null }> {
  try {
    console.log(`${LOG} downloading transcript JSON...`);
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(`download returned ${response.status}`);
    }

    const entries = (await response.json()) as RecallTranscriptEntry[];
    console.log(`${LOG} downloaded ${entries.length} transcript entries`);

    return { data: entries, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} failed to download transcript:`, message);
    return { data: null, error: message };
  }
}
