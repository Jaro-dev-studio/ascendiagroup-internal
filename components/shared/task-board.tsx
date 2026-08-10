"use client";

import { useState, useTransition } from "react";
import { CalendarDays, GripVertical, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import type { TaskStatus } from "@prisma/client";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { deleteTask, setTaskStatus } from "@/lib/actions/tasks";
import { cn, daysUntil, formatDate } from "@/lib/utils";

export interface BoardTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  assignee: { name: string | null; email: string } | null;
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "BACKLOG", label: "Backlog" },
  { status: "TODO", label: "To do" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "REVIEW", label: "Review" },
  { status: "DONE", label: "Done" },
];

export function TaskBoard({
  tasks,
  onEdit,
}: {
  tasks: BoardTask[];
  onEdit?: (task: BoardTask) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverColumn, setHoverColumn] = useState<string | null>(null);

  function move(taskId: string, status: string) {
    startTransition(async () => {
      const { error } = await setTaskStatus(taskId, status);
      if (error) toast.error(error);
    });
  }

  function remove(taskId: string) {
    startTransition(async () => {
      const { error } = await deleteTask(taskId);
      if (error) toast.error(error);
      else toast.success("Task deleted.");
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.status);

        return (
          <div
            key={column.status}
            onDragOver={(event) => {
              event.preventDefault();
              setHoverColumn(column.status);
            }}
            onDragLeave={() => setHoverColumn(null)}
            onDrop={(event) => {
              event.preventDefault();
              setHoverColumn(null);
              if (draggingId) move(draggingId, column.status);
              setDraggingId(null);
            }}
            className={cn(
              "flex flex-col gap-3 rounded-lg border border-border bg-background-tertiary p-3 transition-colors",
              hoverColumn === column.status && "border-primary bg-primary-50"
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500">
                {column.label}
              </p>
              <span className="rounded-full bg-card px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {columnTasks.length}
              </span>
            </div>

            <div className="flex min-h-[60px] flex-col gap-2">
              {columnTasks.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  Drop tasks here
                </p>
              ) : (
                columnTasks.map((task) => {
                  const remaining = daysUntil(task.dueDate);
                  const isOverdue =
                    remaining !== null && remaining < 0 && task.status !== "DONE";

                  return (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={() => setDraggingId(task.id)}
                      onDragEnd={() => setDraggingId(null)}
                      className={cn(
                        "group cursor-grab rounded-md border border-border bg-card p-3 shadow-card transition-shadow hover:shadow-card-hover active:cursor-grabbing",
                        draggingId === task.id && "opacity-50"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-0.5 size-3.5 shrink-0 text-secondary-300" />
                        <button
                          type="button"
                          onClick={() => onEdit?.(task)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="text-sm font-medium leading-snug text-secondary-900">
                            {task.title}
                          </p>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete task"
                          disabled={isPending}
                          onClick={() => remove(task.id)}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <Trash2 className="size-3.5 text-danger-600" />
                        </Button>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusBadge kind="priority" value={task.priority} />
                        {task.dueDate && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[11px]",
                              isOverdue ? "text-danger-600" : "text-muted-foreground"
                            )}
                          >
                            <CalendarDays className="size-3" />
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                        {task.assignee && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <User className="size-3" />
                            {task.assignee.name ?? task.assignee.email}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
