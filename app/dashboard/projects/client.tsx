"use client";

import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface ProjectRow {
  id: string;
  name: string;
  status: string;
  dueDate: Date | null;
  client: { id: string; name: string };
  owner: { name: string | null; email: string } | null;
  tasks: { status: string }[];
}

export function ProjectsClient({
  projects,
  error,
}: {
  projects: ProjectRow[];
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Projects"
        description="Delivery boards created from onboarding submissions or set up manually."
        actions={
          <Button asChild>
            <Link href="/dashboard/projects/new">
              <Plus className="mr-2 size-4" />
              New project
            </Link>
          </Button>
        }
      />

      {error && (
        <p className="rounded-md border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </p>
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Process an onboarding submission to scaffold a project automatically, or create one by hand."
          action={
            <Button asChild>
              <Link href="/dashboard/projects/new">
                <Plus className="mr-2 size-4" />
                Create project
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const done = project.tasks.filter(
              (task) => task.status === "DONE"
            ).length;
            const percent =
              project.tasks.length === 0
                ? 0
                : Math.round((done / project.tasks.length) * 100);

            return (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-secondary-900">
                      {project.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {project.client.name}
                    </p>
                  </div>
                  <StatusBadge kind="project" value={project.status} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {done}/{project.tasks.length} tasks
                    </span>
                    <span className="tabular-nums">{percent}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary-100">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {project.owner
                    ? `Owner: ${project.owner.name ?? project.owner.email}`
                    : "No owner"}
                  {project.dueDate ? ` · due ${formatDate(project.dueDate)}` : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
