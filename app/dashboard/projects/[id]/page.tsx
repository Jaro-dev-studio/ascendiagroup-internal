import { notFound } from "next/navigation";

import { requireStaff } from "@/lib/auth-helpers";
import { listStaffUsers } from "@/lib/fetchers/clients";
import { getProject } from "@/lib/fetchers/projects";

import { ProjectDetailClient } from "./client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await getProject(id);
  return { title: data?.name ?? "Project" };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const [{ data: project }, { data: users }] = await Promise.all([
    getProject(id),
    listStaffUsers(),
  ]);

  if (!project) notFound();

  return <ProjectDetailClient project={project} users={users ?? []} />;
}
