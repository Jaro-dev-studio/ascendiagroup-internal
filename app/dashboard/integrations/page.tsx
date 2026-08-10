import { requireAdmin } from "@/lib/auth-helpers";
import { listIntegrations } from "@/lib/fetchers/integrations";

import { IntegrationsClient } from "./client";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  await requireAdmin();
  const { data, error } = await listIntegrations();

  return <IntegrationsClient integrations={data ?? []} error={error} />;
}
