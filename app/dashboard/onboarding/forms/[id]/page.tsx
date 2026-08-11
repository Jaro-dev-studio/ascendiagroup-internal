import { notFound } from "next/navigation";

import { requireStaff } from "@/lib/auth-helpers";
import { listClientOptions } from "@/lib/fetchers/clients";
import { getOnboardingForm } from "@/lib/fetchers/onboarding";

import { FormDetailClient } from "./client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await getOnboardingForm(id);
  return { title: data?.name ?? "Intake form" };
}

export default async function FormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const [{ data: form }, { data: clients }] = await Promise.all([
    getOnboardingForm(id),
    listClientOptions(),
  ]);

  if (!form) notFound();

  return <FormDetailClient form={form} clients={clients ?? []} />;
}
