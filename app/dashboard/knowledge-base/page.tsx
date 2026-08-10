import Link from "next/link";
import { BookOpen } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth-helpers";
import { listClientOptions } from "@/lib/fetchers/clients";
import { getKnowledgeBase, getKnowledgeCounts } from "@/lib/fetchers/knowledge";
import { isIntegrationConnected } from "@/lib/integrations/store";

import { KnowledgeBaseClient } from "./client";

export const metadata = { title: "Knowledge base" };

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  await requireStaff();
  const { clientId } = await searchParams;

  const [{ data: clients }, { data: counts }, isClaudeConnected] =
    await Promise.all([
      listClientOptions(),
      getKnowledgeCounts(),
      isIntegrationConnected("CLAUDE"),
    ]);

  if (!clients || clients.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Knowledge base"
          description="One searchable context store per practice, connected to Claude."
        />
        <EmptyState
          icon={BookOpen}
          title="No clients yet"
          description="Add a client and their onboarding answers, calls and WhatsApp threads will build up here."
          action={
            <Button asChild>
              <Link href="/dashboard/clients/new">Add client</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const activeClientId = clientId || clients[0].id;
  const { data, error } = await getKnowledgeBase(activeClientId);

  return (
    <KnowledgeBaseClient
      clients={clients.map((client) => ({
        ...client,
        documentCount: counts?.[client.id] ?? 0,
      }))}
      activeClientId={activeClientId}
      client={data?.client ?? null}
      documents={data?.documents ?? []}
      conversation={data?.conversation ?? null}
      isClaudeConnected={isClaudeConnected}
      error={error}
    />
  );
}
