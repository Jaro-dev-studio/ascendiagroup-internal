import { notFound } from "next/navigation";

import { requireStaff } from "@/lib/auth-helpers";
import { getClientDetail } from "@/lib/fetchers/clients";

import { ClientDetailClient } from "./client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await getClientDetail(id);
  return { title: data?.name ?? "Client" };
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const { data } = await getClientDetail(id);

  if (!data) notFound();

  return <ClientDetailClient client={data} />;
}
