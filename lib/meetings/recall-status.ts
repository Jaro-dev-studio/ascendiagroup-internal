import prisma from "@/lib/prisma";
import type { RecordingDecision } from "@prisma/client";

const LOG = "[Recall Status]";

/**
 * Bot lifecycle codes mapped onto our CalendarEvent decision states. Keyed by
 * the bare code so both webhook events ("bot.joining_call") and bot objects
 * read from the API ("joining_call") resolve through the same table.
 */
export const BOT_STATUS_DECISIONS: Record<
  string,
  RecordingDecision | undefined
> = {
  joining_call: "SCHEDULED",
  in_waiting_room: "SCHEDULED",
  in_call_not_recording: "SCHEDULED",
  recording_permission_denied: "FAILED",
  in_call_recording: "RECORDING",
  call_ended: "RECORDING",
  done: "RECORDING",
  fatal: "FAILED",
};

/** Codes that mean the bot will never produce a recording. */
export const FAILED_BOT_CODES = new Set([
  "fatal",
  "recording_permission_denied",
]);

/**
 * Mirrors a bot's lifecycle code onto its CalendarEvent. Never downgrades an
 * event that already finished, so a late webhook cannot undo an ingest.
 */
export async function applyBotStatus(
  botId: string,
  code: string,
  subCode: string | null
): Promise<void> {
  const decision = BOT_STATUS_DECISIONS[code];

  console.log(`${LOG} bot ${botId} -> ${code}${subCode ? ` (${subCode})` : ""}`);

  await prisma.calendarEvent.updateMany({
    where: { recallBotId: botId, decision: { notIn: ["COMPLETED"] } },
    data: {
      botStatus: code,
      ...(decision ? { decision } : {}),
      ...(FAILED_BOT_CODES.has(code)
        ? { decisionReason: `Recall bot failed: ${subCode ?? code}` }
        : {}),
    },
  });
}

/** The most recent lifecycle code the bot reported, if it reported any. */
export function latestBotStatus(
  statusChanges: Array<{ code: string; created_at: string }> | undefined
): string | null {
  if (!statusChanges?.length) return null;

  return statusChanges.reduce((latest, change) =>
    new Date(change.created_at) >= new Date(latest.created_at) ? change : latest
  ).code;
}
