import { PageHeader } from "@/components/shared/page-header";
import { requireStaff } from "@/lib/auth-helpers";
import { listClientOptions, listStaffUsers } from "@/lib/fetchers/clients";

import { NewProjectClient } from "./client";

export const metadata = { title: "New project" };

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  await requireStaff();
  const { clientId } = await searchParams;

  const [{ data: clients }, { data: users }] = await Promise.all([
    listClientOptions(),
    listStaffUsers(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New project"
        description="Set up a delivery board for a client engagement."
      />
      <div className="max-w-2xl">
        <NewProjectClient
          clients={clients ?? []}
          users={users ?? []}
          defaultClientId={clientId ?? ""}
        />
      </div>
    </div>
  );
}
