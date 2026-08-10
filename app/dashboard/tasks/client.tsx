"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CircleCheckBig, LayoutGrid, List, Plus } from "lucide-react";
import { toast } from "sonner";

import { TaskModal, type TaskModalValues } from "@/components/modals/task-modal";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TaskBoard, type BoardTask } from "@/components/shared/task-board";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setTaskStatus } from "@/lib/actions/tasks";
import { cn, daysUntil, formatDate, titleCase } from "@/lib/utils";

interface TaskRow extends BoardTask {
  assigneeId: string | null;
  clientId: string | null;
  client: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
}

const STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"];

export function TasksClient({
  tasks,
  clients,
  users,
  error,
  currentUserId,
  filters,
}: {
  tasks: TaskRow[];
  clients: { id: string; name: string }[];
  users: { id: string; name: string | null; email: string }[];
  error: string | null;
  currentUserId: string;
  filters: { status: string; assigneeId: string; clientId: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<"list" | "board">("list");
  const [isTaskOpen, setIsTaskOpen] = useState(false);
  const [taskValues, setTaskValues] = useState<Partial<TaskModalValues>>({});

  function applyFilters(next: Partial<typeof filters>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    Object.entries(merged).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    router.push(`/dashboard/tasks?${params.toString()}`);
  }

  function openNewTask() {
    setTaskValues({ status: "TODO", priority: "MEDIUM", clientId: filters.clientId });
    setIsTaskOpen(true);
  }

  function openEditTask(task: BoardTask) {
    const full = tasks.find((item) => item.id === task.id);
    setTaskValues({
      id: task.id,
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      assigneeId: full?.assigneeId ?? "",
      clientId: full?.clientId ?? "",
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "",
    });
    setIsTaskOpen(true);
  }

  function toggleDone(task: TaskRow) {
    startTransition(async () => {
      const { error: moveError } = await setTaskStatus(
        task.id,
        task.status === "DONE" ? "TODO" : "DONE"
      );
      if (moveError) toast.error(moveError);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tasks"
        description="Every delivery task across clients, with owners, due dates and status."
        actions={
          <>
            <div className="flex rounded-md border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setView("list")}
                aria-label="List view"
                className={cn(
                  "rounded px-2.5 py-1.5 transition-colors",
                  view === "list"
                    ? "bg-primary-50 text-primary-700"
                    : "text-muted-foreground hover:text-secondary-900"
                )}
              >
                <List className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setView("board")}
                aria-label="Board view"
                className={cn(
                  "rounded px-2.5 py-1.5 transition-colors",
                  view === "board"
                    ? "bg-primary-50 text-primary-700"
                    : "text-muted-foreground hover:text-secondary-900"
                )}
              >
                <LayoutGrid className="size-4" />
              </button>
            </div>
            <Button onClick={openNewTask}>
              <Plus className="mr-2 size-4" />
              New task
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          value={filters.status || "all"}
          onValueChange={(value) =>
            applyFilters({ status: value === "all" ? "" : value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {titleCase(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.assigneeId || "all"}
          onValueChange={(value) =>
            applyFilters({ assigneeId: value === "all" ? "" : value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Anyone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            <SelectItem value={currentUserId}>Assigned to me</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name ?? user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.clientId || "all"}
          onValueChange={(value) =>
            applyFilters({ clientId: value === "all" ? "" : value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="rounded-md border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </p>
      )}

      {tasks.length === 0 ? (
        <EmptyState
          icon={CircleCheckBig}
          title="No tasks match"
          description="Create a task, or process an onboarding submission to generate delivery tasks automatically."
          action={<Button onClick={openNewTask}>Create task</Button>}
        />
      ) : view === "board" ? (
        <TaskBoard tasks={tasks} onEdit={openEditTask} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
          <ul className="divide-y divide-border">
            {tasks.map((task) => {
              const remaining = daysUntil(task.dueDate);
              const isOverdue =
                remaining !== null && remaining < 0 && task.status !== "DONE";

              return (
                <li
                  key={task.id}
                  className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted sm:flex-row sm:items-center sm:gap-4"
                >
                  <button
                    type="button"
                    aria-label="Toggle complete"
                    disabled={isPending}
                    onClick={() => toggleDone(task)}
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                      task.status === "DONE"
                        ? "border-accent bg-accent text-white"
                        : "border-secondary-300 hover:border-primary"
                    )}
                  >
                    {task.status === "DONE" && (
                      <CircleCheckBig className="size-3" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditTask(task)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        task.status === "DONE"
                          ? "text-muted-foreground line-through"
                          : "text-secondary-900"
                      )}
                    >
                      {task.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {task.client?.name ?? "Internal"}
                      {task.project ? ` · ${task.project.name}` : ""}
                      {task.assignee
                        ? ` · ${task.assignee.name ?? task.assignee.email}`
                        : " · Unassigned"}
                    </p>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    {task.dueDate && (
                      <span
                        className={cn(
                          "text-xs",
                          isOverdue ? "text-danger-600" : "text-muted-foreground"
                        )}
                      >
                        {formatDate(task.dueDate)}
                      </span>
                    )}
                    <StatusBadge kind="priority" value={task.priority} />
                    <StatusBadge kind="task" value={task.status} />
                    {task.project && (
                      <Link
                        href={`/dashboard/projects/${task.project.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Board
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <TaskModal
        isOpen={isTaskOpen}
        onOpenChange={setIsTaskOpen}
        clients={clients}
        assignees={users}
        initialValues={taskValues}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
