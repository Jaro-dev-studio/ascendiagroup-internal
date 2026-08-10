import { requireStaff } from "@/lib/auth-helpers";
import { listClientOptions } from "@/lib/fetchers/clients";
import { listOnboardingForms, listSubmissions } from "@/lib/fetchers/onboarding";

import { SubmissionsClient } from "./client";

export const metadata = { title: "Submissions" };

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; clientId?: string }>;
}) {
  await requireStaff();
  const { status, clientId } = await searchParams;

  const [{ data: submissions, error }, { data: forms }, { data: clients }] =
    await Promise.all([
      listSubmissions({ status, clientId }),
      listOnboardingForms(),
      listClientOptions(),
    ]);

  return (
    <SubmissionsClient
      submissions={submissions ?? []}
      forms={(forms ?? []).map((form) => ({
        id: form.id,
        name: form.name,
        fieldCount: form._count.fields,
      }))}
      clients={clients ?? []}
      error={error}
      activeStatus={status ?? "ALL"}
      activeClientId={clientId ?? ""}
    />
  );
}
