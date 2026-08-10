import { pollPendingRecordings } from "@/lib/crm/recorder-poll";
import { createCronRoute } from "@/lib/cron/route-handler";

export const maxDuration = 300;

/**
 * Reconciles scheduled bots against Recall so no recording depends on a webhook
 * delivery arriving. Runs every 5 minutes; a call that ends between runs is
 * picked up on the next pass.
 */
export const GET = createCronRoute("poll-recordings", async () => {
  return pollPendingRecordings();
});
