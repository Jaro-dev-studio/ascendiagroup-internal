import { requireStaff } from "@/lib/auth-helpers";
import { listProjects } from "@/lib/fetchers/projects";

import { ProjectsClient } from "./client";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  await requireStaff();
  const { clientId } = await searchParams;
  const { data, error } = await listProjects(clientId);

  return <ProjectsClient projects={data ?? []} error={error} />;
}
