import { notFound } from "next/navigation";

import { requireStaff } from "@/lib/auth-helpers";
import { getMeeting } from "@/lib/fetchers/meetings";
import { isIntegrationConnected } from "@/lib/integrations/store";

import { MeetingDetailClient } from "./client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await getMeeting(id);
  return { title: data?.title ?? "Call" };
}

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const [{ data: meeting }, isClaudeConnected] = await Promise.all([
    getMeeting(id),
    isIntegrationConnected("CLAUDE"),
  ]);

  if (!meeting) notFound();

  return (
    <MeetingDetailClient meeting={meeting} isClaudeConnected={isClaudeConnected} />
  );
}
