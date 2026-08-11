import { notFound } from "next/navigation";

import { requireStaff } from "@/lib/auth-helpers";
import { getStrategy } from "@/lib/fetchers/strategies";

import { StrategyDetailClient } from "./client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await getStrategy(id);
  return { title: data?.title ?? "Strategy" };
}

export default async function StrategyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const { data } = await getStrategy(id);

  if (!data) notFound();

  return <StrategyDetailClient strategy={data} />;
}
