import { requireStaff } from "@/lib/auth-helpers";
import { listClientOptions } from "@/lib/fetchers/clients";
import { listMeetings } from "@/lib/fetchers/meetings";
import { getIntegrationCredentials } from "@/lib/integrations/store";

import { MeetingsClient } from "./client";

export const metadata = { title: "Calls" };

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  await requireStaff();
  const { clientId } = await searchParams;

  const [{ data: meetings, error }, { data: clients }, recorder] =
    await Promise.all([
      listMeetings(clientId),
      listClientOptions(),
      getIntegrationCredentials("CALL_RECORDING"),
    ]);

  return (
    <MeetingsClient
      meetings={meetings ?? []}
      clients={clients ?? []}
      error={error}
      activeClientId={clientId ?? ""}
      webhookToken={recorder?.webhookToken ?? null}
    />
  );
}
