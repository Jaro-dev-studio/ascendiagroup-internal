import { requireStaff } from "@/lib/auth-helpers";
import { listClientOptions } from "@/lib/fetchers/clients";
import { listWhatsAppMessages } from "@/lib/fetchers/meetings";
import { getIntegrationCredentials } from "@/lib/integrations/store";

import { WhatsAppClient } from "./client";

export const metadata = { title: "WhatsApp" };

export default async function WhatsAppPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  await requireStaff();
  const { clientId } = await searchParams;

  const [{ data: messages, error }, { data: clients }, credentials] =
    await Promise.all([
      listWhatsAppMessages(clientId),
      listClientOptions(),
      getIntegrationCredentials("WHATSAPP"),
    ]);

  return (
    <WhatsAppClient
      messages={messages ?? []}
      clients={clients ?? []}
      error={error}
      activeClientId={clientId ?? ""}
      verifyToken={credentials?.verifyToken ?? null}
    />
  );
}
