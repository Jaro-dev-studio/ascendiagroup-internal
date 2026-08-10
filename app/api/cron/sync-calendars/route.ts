import { syncCalendarsAndScheduleBots } from "@/lib/crm/calendar-sync";
import { createCronRoute } from "@/lib/cron/route-handler";

export const maxDuration = 300;

/**
 * Pulls @jaro.dev calendars and keeps Recall bots in sync with them.
 *
 * Runs every 10 minutes; Recall needs at least 10 minutes of lead time for a
 * bot to be guaranteed, so the interval and the rules' joinMinutesBefore
 * together decide how early a bot is created.
 */
export const GET = createCronRoute("sync-calendars", async () => {
  return syncCalendarsAndScheduleBots();
});
