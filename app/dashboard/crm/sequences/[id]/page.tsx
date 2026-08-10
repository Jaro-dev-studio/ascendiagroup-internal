import { notFound, redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth-helpers";
import {
  getEnrollableContacts,
  getSenderMailboxes,
  getSequenceDetail,
} from "@/lib/fetchers/sequences";
import { getCrmFilterOptions } from "@/lib/fetchers/crm-filters";
import { EMPTY_DYNAMIC_OPTIONS } from "@/lib/crm/filters/columns";
import { SequenceDetailClient } from "./client";

export default async function SequenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAdminUser();
  if (!user) redirect("/dashboard");

  const { id } = await params;

  const [sequenceResult, mailboxesResult, contactsResult, filterOptionsResult] =
    await Promise.all([
      getSequenceDetail(id),
      getSenderMailboxes(),
      getEnrollableContacts(id),
      getCrmFilterOptions(),
    ]);

  if (!sequenceResult.data) notFound();

  return (
    <SequenceDetailClient
      sequence={sequenceResult.data}
      mailboxes={mailboxesResult.data ?? []}
      enrollableContacts={contactsResult.data ?? []}
      filterOptions={filterOptionsResult.data ?? EMPTY_DYNAMIC_OPTIONS}
    />
  );
}
