import { requireStaff } from "@/lib/auth-helpers";
import { listClients } from "@/lib/fetchers/clients";

import { ClientsClient } from "./client";

export const metadata = { title: "Clients" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireStaff();
  const { q } = await searchParams;
  const { data, error } = await listClients(q);

  return <ClientsClient clients={data ?? []} error={error} search={q ?? ""} />;
}
