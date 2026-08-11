import { requireStaff } from "@/lib/auth-helpers";
import { getReportingOverview } from "@/lib/fetchers/reporting";

import { ReportingClient } from "./client";

export const metadata = { title: "Reporting" };

export default async function ReportingPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  await requireStaff();
  const { clientId } = await searchParams;
  const { data, error } = await getReportingOverview(clientId);

  return (
    <ReportingClient
      clients={data?.clients ?? []}
      metrics={data?.metrics ?? []}
      reports={data?.reports ?? []}
      links={data?.links ?? []}
      activeClientId={clientId ?? ""}
      error={error}
    />
  );
}
