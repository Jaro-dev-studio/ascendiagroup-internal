import { notFound } from "next/navigation";

import { requireStaff } from "@/lib/auth-helpers";
import { listClientOptions } from "@/lib/fetchers/clients";
import { getSubmission } from "@/lib/fetchers/onboarding";

import { SubmissionDetailClient } from "./client";

export const metadata = { title: "Submission" };

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const [{ data: submission }, { data: clients }] = await Promise.all([
    getSubmission(id),
    listClientOptions(),
  ]);

  if (!submission) notFound();

  return (
    <SubmissionDetailClient submission={submission} clients={clients ?? []} />
  );
}
