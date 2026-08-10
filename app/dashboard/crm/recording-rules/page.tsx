import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth-helpers";
import {
  getCalendarEvents,
  getRecorderConfigStatus,
  getRecordingRules,
  getWorkspaceMailboxes,
} from "@/lib/fetchers/recording-rules";
import { RecordingRulesClient } from "./client";

export default async function RecordingRulesPage() {
  const user = await getAdminUser();
  if (!user) redirect("/dashboard");

  const [rulesResult, eventsResult, mailboxesResult, config] = await Promise.all([
    getRecordingRules(),
    getCalendarEvents(),
    getWorkspaceMailboxes(),
    getRecorderConfigStatus(),
  ]);

  return (
    <RecordingRulesClient
      rules={rulesResult.data ?? []}
      events={eventsResult.data ?? []}
      mailboxes={mailboxesResult.data ?? []}
      config={config}
    />
  );
}
