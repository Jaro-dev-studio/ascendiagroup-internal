"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, Plus, Trello } from "lucide-react";
import { toast } from "sonner";

import { TaskModal, type TaskModalValues } from "@/components/modals/task-modal";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TaskBoard, type BoardTask } from "@/components/shared/task-board";
import { Button } from "@/components/ui/button";
import { syncProjectToTrello } from "@/lib/actions/projects";
import { formatDate } from "@/lib/utils";

interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  dueDate: Date | null;
  trelloBoardUrl: string | null;
  client: { id: string; name: string; driveFolderUrl: string | null };
  owner: { id: string; name: string | null; email: string } | null;
  tasks: (BoardTask & { assigneeId: string | null })[];
}

export function ProjectDetailClient({
  project,
  users,
}: {
  project: ProjectDetail;
  users: { id: string; name: string | null; email: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isTaskOpen, setIsTaskOpen] = useState(false);
  const [taskValues, setTaskValues] = useState<Partial<TaskModalValues>>({});

  function openNewTask() {
    setTaskValues({ status: "TODO", priority: "MEDIUM" });
    setIsTaskOpen(true);
  }

  function openEditTask(task: BoardTask) {
    const full = project.tasks.find((item) => item.id === task.id);
    setTaskValues({
      id: task.id,
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      assigneeId: full?.assigneeId ?? "",
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "",
    });
    setIsTaskOpen(true);
  }

  function onSyncTrello() {
    startTransition(async () => {
      const { data, error } = await syncProjectToTrello(project.id);
      if (error) toast.error(error);
      else toast.success(`Pushed ${data?.cards ?? 0} cards to Trello.`);
    });
  }

  const done = project.tasks.filter((task) => task.status === "DONE").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        actions={
          <>
            {project.trelloBoardUrl ? (
              <Button asChild variant="outline">
                <a href={project.trelloBoardUrl} target="_blank" rel="noreferrer">
                  <Trello className="mr-2 size-4" />
                  Trello board
                  <ExternalLink className="ml-2 size-3.5" />
                </a>
              </Button>
            ) : null}
            <Button variant="outline" onClick={onSyncTrello} disabled={isPending}>
              <Trello className="mr-2 size-4" />
              Sync to Trello
            </Button>
            <Button onClick={openNewTask}>
              <Plus className="mr-2 size-4" />
              New task
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <StatusBadge kind="project" value={project.status} />
        <Link
          href={`/dashboard/clients/${project.client.id}`}
          className="text-primary hover:underline"
        >
          {project.client.name}
        </Link>
        <span>
          {done}/{project.tasks.length} tasks complete
        </span>
        {project.dueDate && <span>Due {formatDate(project.dueDate)}</span>}
        {project.owner && (
          <span>Owner: {project.owner.name ?? project.owner.email}</span>
        )}
      </div>

      <TaskBoard tasks={project.tasks} onEdit={openEditTask} />

      <TaskModal
        isOpen={isTaskOpen}
        onOpenChange={setIsTaskOpen}
        projectId={project.id}
        assignees={users}
        initialValues={taskValues}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
