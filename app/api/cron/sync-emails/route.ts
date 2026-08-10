import { syncMailboxEmails } from "@/lib/crm/email-sync";
import { createCronRoute } from "@/lib/cron/route-handler";

export const maxDuration = 300;

/** Records mail exchanged with contacts on their timeline. Runs every 15 minutes. */
export const GET = createCronRoute("sync-emails", async () => {
  return syncMailboxEmails();
});
