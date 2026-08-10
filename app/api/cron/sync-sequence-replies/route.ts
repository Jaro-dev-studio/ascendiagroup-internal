import { syncSequenceReplies } from "@/lib/crm/sequences/replies";
import { createCronRoute } from "@/lib/cron/route-handler";

export const maxDuration = 300;

/** Detects replies and bounces on active sequence threads. Runs every 15 minutes. */
export const GET = createCronRoute("sync-sequence-replies", async () => {
  return syncSequenceReplies();
});
