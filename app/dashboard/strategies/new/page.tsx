import { PageHeader } from "@/components/shared/page-header";
import { requireStaff } from "@/lib/auth-helpers";
import { listClientOptions } from "@/lib/fetchers/clients";
import { getStrategySources } from "@/lib/fetchers/strategies";
import { isIntegrationConnected } from "@/lib/integrations/store";

import { NewStrategyClient } from "./client";

export const metadata = { title: "Generate strategy" };

export default async function NewStrategyPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  await requireStaff();
  const { clientId } = await searchParams;

  const [{ data: clients }, isClaudeConnected] = await Promise.all([
    listClientOptions(),
    isIntegrationConnected("CLAUDE"),
  ]);

  const sources = clientId ? await getStrategySources(clientId) : { data: null };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Generate a 90 day strategy"
        description="Claude reads the onboarding answers and call transcripts you select, then drafts a 30/60/90 day roadmap you can edit and push to the board."
      />
      <div className="max-w-3xl">
        <NewStrategyClient
          clients={clients ?? []}
          defaultClientId={clientId ?? ""}
          initialSources={sources.data}
          isClaudeConnected={isClaudeConnected}
        />
      </div>
    </div>
  );
}
