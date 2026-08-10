import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth-helpers";
import {
  getSequenceConfigStatus,
  getSenderMailboxes,
  getSequences,
} from "@/lib/fetchers/sequences";
import { getCrmFilterOptions } from "@/lib/fetchers/crm-filters";
import { EMPTY_DYNAMIC_OPTIONS } from "@/lib/crm/filters/columns";
import { SequencesClient } from "./client";

export default async function SequencesPage() {
  const user = await getAdminUser();
  if (!user) redirect("/dashboard");

  const [sequencesResult, mailboxesResult, config, filterOptionsResult] =
    await Promise.all([
      getSequences(),
      getSenderMailboxes(),
      getSequenceConfigStatus(),
      getCrmFilterOptions(),
    ]);

  return (
    <SequencesClient
      sequences={sequencesResult.data ?? []}
      mailboxes={mailboxesResult.data ?? []}
      config={config}
      filterOptions={filterOptionsResult.data ?? EMPTY_DYNAMIC_OPTIONS}
    />
  );
}
