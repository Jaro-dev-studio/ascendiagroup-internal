import { processDueSequences } from "@/lib/crm/sequences/engine";
import { stopEnrollmentsWithBookedMeetings } from "@/lib/crm/sequences/replies";
import { autoEnrollFromEntryCriteria } from "@/lib/crm/sequences/entry-criteria";
import { stopEnrollmentsMatchingExitCriteria } from "@/lib/crm/sequences/exit-criteria";
import { createCronRoute } from "@/lib/cron/route-handler";

export const maxDuration = 300;

/** Sends every sequence step that is due. Runs every 5 minutes. */
export const GET = createCronRoute("process-sequences", async () => {
  // Each pre-send step is reported rather than thrown: a failure to trim the
  // enrollment list must not stop the sends that are already due.
  const failures: string[] = [];

  // Booked meetings are an exit condition, so clear them before sending
  const bookings = await stopEnrollmentsWithBookedMeetings();
  if (bookings.error) {
    failures.push(`Booked-meeting exit check failed: ${bookings.error}`);
  }

  // Custom exit criteria are an exit condition too, checked before sending so
  // a contact who no longer qualifies gets no further email
  const exits = await stopEnrollmentsMatchingExitCriteria();
  if (exits.error) {
    failures.push(`Exit criteria check failed: ${exits.error}`);
  }

  // Then pick up anyone who has started matching a sequence's entry criteria
  const autoEnrolled = await autoEnrollFromEntryCriteria();
  if (autoEnrolled.error) {
    failures.push(`Auto-enrollment failed: ${autoEnrolled.error}`);
  }

  const result = await processDueSequences();

  if (result.error) {
    return { data: null, error: result.error };
  }

  // Send failures are reported by the engine itself, so they alert for the
  // manual "run now" path too rather than only for this cron.
  return {
    data: {
      ...result.data,
      stoppedAfterBooking: bookings.data?.stopped ?? 0,
      stoppedByExitCriteria: exits.data?.stopped ?? 0,
      autoEnrolled: autoEnrolled.data?.enrolled ?? 0,
    },
    error: null,
    failures,
  };
});
