"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, Search } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, titleCase } from "@/lib/utils";

interface ClientRow {
  id: string;
  name: string;
  status: string;
  practiceType: string | null;
  city: string | null;
  packageTier: string | null;
  startDate: Date | null;
  accountManager: { name: string | null; email: string } | null;
  services: { service: string }[];
  _count: { projects: number; tasks: number; documents: number };
}

interface ClientsClientProps {
  clients: ClientRow[];
  error: string | null;
  search: string;
}

export function ClientsClient({ clients, error, search }: ClientsClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState(search);

  function onSearch(event: React.FormEvent) {
    event.preventDefault();
    router.push(query ? `/dashboard/clients?q=${encodeURIComponent(query)}` : "/dashboard/clients");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clients"
        description="Every practice you deliver for, with services, owner and delivery volume."
        actions={
          <Button asChild>
            <Link href="/dashboard/clients/new">
              <Plus className="mr-2 size-4" />
              New client
            </Link>
          </Button>
        }
      />

      <form onSubmit={onSearch} className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by practice, contact or city"
          icon={<Search className="size-4" />}
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {error && (
        <p className="rounded-md border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </p>
      )}

      {clients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={search ? "No clients match that search" : "No clients yet"}
          description={
            search
              ? "Try a different practice name, contact or city."
              : "Add a practice to start onboarding, generate a strategy and scaffold delivery."
          }
          action={
            !search && (
              <Button asChild>
                <Link href="/dashboard/clients/new">
                  <Plus className="mr-2 size-4" />
                  Add client
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((client, index) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.2) }}
            >
              <Link
                href={`/dashboard/clients/${client.id}`}
                className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-secondary-900">
                      {client.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[client.practiceType, client.city]
                        .filter(Boolean)
                        .join(" · ") || "No practice details yet"}
                    </p>
                  </div>
                  <StatusBadge kind="client" value={client.status} />
                </div>

                {client.services.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {client.services.slice(0, 4).map((service) => (
                      <span
                        key={service.service}
                        className="rounded-full bg-secondary-100 px-2 py-0.5 text-[11px] font-medium text-secondary-600"
                      >
                        {titleCase(service.service)}
                      </span>
                    ))}
                    {client.services.length > 4 && (
                      <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-[11px] font-medium text-secondary-600">
                        +{client.services.length - 4}
                      </span>
                    )}
                  </div>
                )}

                <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Projects</dt>
                    <dd className="text-sm font-semibold text-secondary-900">
                      {client._count.projects}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Tasks</dt>
                    <dd className="text-sm font-semibold text-secondary-900">
                      {client._count.tasks}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Docs</dt>
                    <dd className="text-sm font-semibold text-secondary-900">
                      {client._count.documents}
                    </dd>
                  </div>
                </dl>

                <p className="text-xs text-muted-foreground">
                  {client.accountManager
                    ? `Owner: ${client.accountManager.name ?? client.accountManager.email}`
                    : "No account manager"}
                  {client.startDate ? ` · Started ${formatDate(client.startDate)}` : ""}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
