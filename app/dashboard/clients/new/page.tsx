import { ClientForm } from "@/components/forms/client-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireStaff } from "@/lib/auth-helpers";
import { listStaffUsers } from "@/lib/fetchers/clients";

export const metadata = { title: "New client" };

export default async function NewClientPage() {
  await requireStaff();
  const { data: managers } = await listStaffUsers();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New client"
        description="Create the practice record that onboarding, delivery and reporting hang off."
      />
      <div className="max-w-3xl">
        <ClientForm managers={managers ?? []} />
      </div>
    </div>
  );
}
