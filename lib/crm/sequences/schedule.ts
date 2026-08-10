import type { Sequence, SequenceStep } from "@prisma/client";

/**
 * Send-window arithmetic for sequences.
 *
 * All windows are evaluated in the sequence's own timezone using Intl rather
 * than a date library, so a sequence set to 09:00–17:00 Europe/London behaves
 * correctly regardless of where the cron happens to run.
 */

export interface SendWindow {
  timezone: string;
  sendWindowStart: number;
  sendWindowEnd: number;
  sendOnWeekends: boolean;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Reads the wall-clock parts of an instant in a given timezone. */
export function getZonedParts(date: Date, timezone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const lookup = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(lookup("year")),
    month: Number(lookup("month")),
    day: Number(lookup("day")),
    // Intl renders midnight as hour 24 in some locales
    hour: Number(lookup("hour")) % 24,
    minute: Number(lookup("minute")),
    weekday: WEEKDAY_INDEX[lookup("weekday")] ?? 0,
  };
}

/** Offset between a timezone and UTC at a given instant, in minutes. */
function getZoneOffsetMinutes(date: Date, timezone: string): number {
  const parts = getZonedParts(date, timezone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    date.getUTCSeconds()
  );
  return (asUtc - date.getTime()) / 60_000;
}

/** Builds the instant matching a wall-clock time in the given timezone. */
function zonedTimeToUtc(
  parts: { year: number; month: number; day: number; hour: number; minute: number },
  timezone: string
): Date {
  const naive = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute
  );

  // Two passes settle DST boundaries where the first guess lands on the wrong side
  let guess = new Date(naive - getZoneOffsetMinutes(new Date(naive), timezone) * 60_000);
  guess = new Date(naive - getZoneOffsetMinutes(guess, timezone) * 60_000);
  return guess;
}

export function isWithinSendWindow(date: Date, window: SendWindow): boolean {
  const parts = getZonedParts(date, window.timezone);

  const isWeekend = parts.weekday === 0 || parts.weekday === 6;
  if (isWeekend && !window.sendOnWeekends) return false;

  return (
    parts.hour >= window.sendWindowStart && parts.hour < window.sendWindowEnd
  );
}

/**
 * Moves an instant forward to the next moment the window is open. Returns the
 * input unchanged when the window is already open.
 */
export function nextSendWindowOpening(from: Date, window: SendWindow): Date {
  if (isWithinSendWindow(from, window)) return from;

  let candidate = from;

  // At most a week of hops is needed: the window opens on some allowed weekday
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const parts = getZonedParts(candidate, window.timezone);
    const isWeekend = parts.weekday === 0 || parts.weekday === 6;
    const beforeWindow = parts.hour < window.sendWindowStart;

    if (!isWeekend || window.sendOnWeekends) {
      if (beforeWindow) {
        return zonedTimeToUtc(
          {
            year: parts.year,
            month: parts.month,
            day: parts.day,
            hour: window.sendWindowStart,
            minute: 0,
          },
          window.timezone
        );
      }
    }

    // Jump to the start of the window on the following day and re-check
    const nextDay = zonedTimeToUtc(
      {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: window.sendWindowStart,
        minute: 0,
      },
      window.timezone
    );
    candidate = new Date(nextDay.getTime() + 24 * 3_600_000);

    if (isWithinSendWindow(candidate, window)) return candidate;
  }

  return candidate;
}

/**
 * When the given step should go out, measured from the previous send (or from
 * enrollment for the first step) and clamped into the send window.
 */
export function computeNextSendAt(
  from: Date,
  step: Pick<SequenceStep, "delayDays" | "delayHours">,
  window: SendWindow
): Date {
  const delayMs =
    step.delayDays * 24 * 3_600_000 + step.delayHours * 3_600_000;
  return nextSendWindowOpening(new Date(from.getTime() + delayMs), window);
}

export function toSendWindow(sequence: Sequence): SendWindow {
  return {
    timezone: sequence.timezone,
    sendWindowStart: sequence.sendWindowStart,
    sendWindowEnd: sequence.sendWindowEnd,
    sendOnWeekends: sequence.sendOnWeekends,
  };
}

/** Start of the current day in the sequence's timezone, for daily send caps. */
export function startOfZonedDay(date: Date, timezone: string): Date {
  const parts = getZonedParts(date, timezone);
  return zonedTimeToUtc(
    { year: parts.year, month: parts.month, day: parts.day, hour: 0, minute: 0 },
    timezone
  );
}
