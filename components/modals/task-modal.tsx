"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createTask, updateTask } from "@/lib/actions/tasks";
import { titleCase } from "@/lib/utils";

const STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export interface TaskModalValues {
  id?: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: string;
  dueDate: string;
  clientId: string;
}

interface TaskModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  clients?: { id: string; name: string }[];
  assignees: { id: string; name: string | null; email: string }[];
  initialValues?: Partial<TaskModalValues>;
  onSaved?: () => void;
}

const EMPTY: TaskModalValues = {
  title: "",
  description: "",
  status: "TODO",
  priority: "MEDIUM",
  assigneeId: "",
  dueDate: "",
  clientId: "",
};

export function TaskModal({
  isOpen,
  onOpenChange,
  projectId,
  clients,
  assignees,
  initialValues,
  onSaved,
}: TaskModalProps) {
  const [values, setValues] = useState<TaskModalValues>({
    ...EMPTY,
    ...initialValues,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setValues({ ...EMPTY, ...initialValues });
  }, [isOpen, initialValues]);

  function update<K extends keyof TaskModalValues>(
    key: K,
    value: TaskModalValues[K]
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const payload = {
        title: values.title,
        description: values.description,
        status: values.status,
        priority: values.priority,
        assigneeId: values.assigneeId,
        dueDate: values.dueDate,
        projectId,
        clientId: values.clientId,
      };

      const { error } = values.id
        ? await updateTask(values.id, payload)
        : await createTask(payload);

      if (error) {
        toast.error(error);
        return;
      }

      toast.success(values.id ? "Task updated." : "Task created.");
      onOpenChange(false);
      onSaved?.();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{values.id ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="taskTitle">Title</Label>
            <Input
              id="taskTitle"
              value={values.title}
              onChange={(event) => update("title", event.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="taskDescription">Description</Label>
            <Textarea
              id="taskDescription"
              rows={3}
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </div>

          {clients && !projectId && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="taskClient">Client</Label>
              <Select
                value={values.clientId || "none"}
                onValueChange={(value) =>
                  update("clientId", value === "none" ? "" : value)
                }
              >
                <SelectTrigger id="taskClient">
                  <SelectValue placeholder="Internal task" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Internal task</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="taskStatus">Status</Label>
              <Select
                value={values.status}
                onValueChange={(value) => update("status", value)}
              >
                <SelectTrigger id="taskStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {titleCase(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="taskPriority">Priority</Label>
              <Select
                value={values.priority}
                onValueChange={(value) => update("priority", value)}
              >
                <SelectTrigger id="taskPriority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {titleCase(priority)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="taskAssignee">Assignee</Label>
              <Select
                value={values.assigneeId || "none"}
                onValueChange={(value) =>
                  update("assigneeId", value === "none" ? "" : value)
                }
              >
                <SelectTrigger id="taskAssignee">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {assignees.map((assignee) => (
                    <SelectItem key={assignee.id} value={assignee.id}>
                      {assignee.name ?? assignee.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="taskDue">Due date</Label>
              <Input
                id="taskDue"
                type="date"
                value={values.dueDate}
                onChange={(event) => update("dueDate", event.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {values.id ? "Save task" : "Create task"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
