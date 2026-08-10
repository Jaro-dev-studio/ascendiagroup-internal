"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Edit,
  GitBranch,
  Search,
  ChevronRight,
  Loader2,
  Calendar,
  Clock,
  Zap,
  Paperclip,
  Upload,
  X,
  FileImage,
  FileVideo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  addWorkflowAttachment,
  removeWorkflowAttachment,
} from "@/lib/actions/workflows";
import type { WorkflowListItem } from "@/lib/fetchers/workflows";
import type { WorkflowTriggerType } from "@prisma/client";

interface AttachmentData {
  id: string;
  url: string;
  filename: string;
  type: string;
}

interface WorkflowMapsClientProps {
  workflows: WorkflowListItem[];
}

const TRIGGER_LABELS: Record<string, string> = {
  CONDITION: "Condition",
  SCHEDULE: "Schedule",
  WORKFLOW_COMPLETED: "Workflow Completed",
};

const TRIGGER_ICONS: Record<string, typeof Zap> = {
  CONDITION: Zap,
  SCHEDULE: Clock,
  WORKFLOW_COMPLETED: GitBranch,
};

export function WorkflowMapsClient({
  workflows: initialWorkflows,
}: WorkflowMapsClientProps) {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] =
    useState<WorkflowListItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] =
    useState<WorkflowTriggerType>("CONDITION");
  const [triggerValue, setTriggerValue] = useState("");
  const [triggeredByWorkflowId, setTriggeredByWorkflowId] = useState("");

  const [editAttachments, setEditAttachments] = useState<AttachmentData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredWorkflows = useMemo(() => {
    if (!searchQuery.trim()) return workflows;
    const query = searchQuery.toLowerCase();
    return workflows.filter(
      (w) =>
        w.name.toLowerCase().includes(query) ||
        w.description?.toLowerCase().includes(query)
    );
  }, [workflows, searchQuery]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setTriggerType("CONDITION");
    setTriggerValue("");
    setTriggeredByWorkflowId("");
    setEditAttachments([]);
    setError(null);
  };

  const handleCreate = () => {
    setEditingWorkflow(null);
    resetForm();
    setIsModalOpen(true);
  };

  const handleEdit = (workflow: WorkflowListItem) => {
    setEditingWorkflow(workflow);
    setName(workflow.name);
    setDescription(workflow.description || "");
    setTriggerType(workflow.triggerType as WorkflowTriggerType);
    setTriggerValue(workflow.triggerValue || "");
    setTriggeredByWorkflowId(workflow.triggeredByWorkflowId || "");
    setEditAttachments([]);
    setError(null);
    setIsModalOpen(true);
  };

  const handleFileUpload = async (file: File) => {
    if (!editingWorkflow) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("context", "workflow");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      const fileType = file.type.startsWith("video/") ? "video" : "image";
      const result = await addWorkflowAttachment(
        editingWorkflow.id,
        data.url,
        file.name,
        fileType
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.data) {
        setEditAttachments((prev) => [
          ...prev,
          {
            id: result.data!.id,
            url: data.url,
            filename: file.name,
            type: fileType,
          },
        ]);
      }
    } catch {
      setError("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    const result = await removeWorkflowAttachment(attachmentId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingWorkflow) {
        const result = await updateWorkflow(editingWorkflow.id, {
          name,
          description: description || undefined,
          triggerType,
          triggerValue:
            triggerType === "WORKFLOW_COMPLETED" ? undefined : triggerValue || undefined,
          triggeredByWorkflowId:
            triggerType === "WORKFLOW_COMPLETED"
              ? triggeredByWorkflowId || undefined
              : undefined,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        setWorkflows(
          workflows.map((w) =>
            w.id === editingWorkflow.id
              ? {
                ...w,
                name,
                description: description || null,
                triggerType,
                triggerValue:
                    triggerType === "WORKFLOW_COMPLETED" ? null : triggerValue || null,
                triggeredByWorkflowId:
                    triggerType === "WORKFLOW_COMPLETED"
                      ? triggeredByWorkflowId || null
                      : null,
                triggeredByWorkflow:
                    triggerType === "WORKFLOW_COMPLETED" && triggeredByWorkflowId
                      ? workflows.find((wf) => wf.id === triggeredByWorkflowId)
                        ?.triggeredByWorkflow || {
                        id: triggeredByWorkflowId,
                        name:
                            workflows.find(
                              (wf) => wf.id === triggeredByWorkflowId
                            )?.name || "",
                      }
                      : null,
              }
              : w
          )
        );
      } else {
        const result = await createWorkflow({
          name,
          description: description || undefined,
          triggerType,
          triggerValue:
            triggerType === "WORKFLOW_COMPLETED" ? undefined : triggerValue || undefined,
          triggeredByWorkflowId:
            triggerType === "WORKFLOW_COMPLETED"
              ? triggeredByWorkflowId || undefined
              : undefined,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.data) {
          setWorkflows([
            {
              id: result.data.id,
              name,
              description: description || null,
              triggerType,
              triggerValue:
                triggerType === "WORKFLOW_COMPLETED" ? null : triggerValue || null,
              triggeredByWorkflowId:
                triggerType === "WORKFLOW_COMPLETED"
                  ? triggeredByWorkflowId || null
                  : null,
              triggeredByWorkflow: null,
              _count: { attachments: 0 },
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            ...workflows,
          ]);
        }
      }
      setIsModalOpen(false);
      resetForm();
      setEditingWorkflow(null);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this workflow? This action cannot be undone."
      )
    ) {
      return;
    }

    setIsDeleting(id);
    try {
      const result = await deleteWorkflow(id);
      if (result.error) {
        alert(result.error);
        return;
      }
      setWorkflows(workflows.filter((w) => w.id !== id));
    } catch {
      console.error("Error deleting workflow");
    } finally {
      setIsDeleting(null);
    }
  };

  const otherWorkflows = workflows.filter(
    (w) => w.id !== editingWorkflow?.id
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">
            Workflow Maps
          </h1>
          <p className="text-secondary-600">
            Document and map manual workflows for future automation
          </p>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="mr-2 size-4" />
          New Workflow
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary-400" />
        <Input
          placeholder="Search workflows..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {workflows.length === 0 ? (
        <Card className="p-8 text-center">
          <GitBranch className="mx-auto size-12 text-secondary-400" />
          <h3 className="mt-4 text-lg font-medium text-secondary-900">
            No workflows yet
          </h3>
          <p className="mt-2 text-secondary-600">
            Get started by documenting your first manual workflow
          </p>
          <Button onClick={handleCreate} className="mt-4">
            <Plus className="mr-2 size-4" />
            Create Workflow
          </Button>
        </Card>
      ) : filteredWorkflows.length === 0 ? (
        <Card className="p-8 text-center">
          <Search className="mx-auto size-12 text-secondary-400" />
          <h3 className="mt-4 text-lg font-medium text-secondary-900">
            No results found
          </h3>
          <p className="mt-2 text-secondary-600">
            Try adjusting your search query
          </p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-secondary-200">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500">
                    Name
                  </th>
                  <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500 md:table-cell">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500">
                    Trigger
                  </th>
                  <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500 sm:table-cell">
                    Attachments
                  </th>
                  <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500 sm:table-cell">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-secondary-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-200">
                {filteredWorkflows.map((workflow) => {
                  const TriggerIcon =
                    TRIGGER_ICONS[workflow.triggerType] || Zap;
                  return (
                    <tr
                      key={workflow.id}
                      className="group hover:bg-secondary-50"
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <Link
                          href={`/dashboard/workflow-maps/${workflow.id}`}
                          className="flex items-center gap-3"
                        >
                          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-100">
                            <GitBranch className="size-4 text-primary-600" />
                          </div>
                          <p className="font-medium text-secondary-900 group-hover:text-primary-600">
                            {workflow.name}
                          </p>
                          <ChevronRight className="size-4 text-secondary-300 opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                      </td>
                      <td className="hidden max-w-xs truncate px-6 py-4 text-sm text-secondary-500 md:table-cell">
                        {workflow.description || "-"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <Badge
                          variant="secondary"
                          className="gap-1"
                        >
                          <TriggerIcon className="size-3" />
                          {TRIGGER_LABELS[workflow.triggerType]}
                        </Badge>
                      </td>
                      <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-secondary-500 sm:table-cell">
                        {workflow._count.attachments > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <Paperclip className="size-4" />
                            {workflow._count.attachments}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-secondary-500 sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-4" />
                          {new Date(workflow.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleEdit(workflow)}
                            >
                              <Edit className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(workflow.id)}
                              disabled={isDeleting === workflow.id}
                              className="text-danger-600 focus:text-danger-600"
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingWorkflow ? "Edit Workflow" : "Create Workflow"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="wf-name">Name *</Label>
              <Input
                id="wf-name"
                placeholder="e.g., Client Onboarding"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wf-description">Description</Label>
              <Textarea
                id="wf-description"
                placeholder="What does this workflow do?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Trigger Type</Label>
              <Select
                value={triggerType}
                onValueChange={(v) =>
                  setTriggerType(v as WorkflowTriggerType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONDITION">
                    Condition (event-based)
                  </SelectItem>
                  <SelectItem value="SCHEDULE">
                    Schedule (time-based)
                  </SelectItem>
                  <SelectItem value="WORKFLOW_COMPLETED">
                    Another workflow completes
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {triggerType === "CONDITION" && (
              <div className="space-y-2">
                <Label htmlFor="wf-condition">Condition</Label>
                <Input
                  id="wf-condition"
                  placeholder="e.g., New client signs contract"
                  value={triggerValue}
                  onChange={(e) => setTriggerValue(e.target.value)}
                />
              </div>
            )}

            {triggerType === "SCHEDULE" && (
              <div className="space-y-2">
                <Label htmlFor="wf-schedule">Schedule</Label>
                <Input
                  id="wf-schedule"
                  placeholder="e.g., Every Monday at 9am"
                  value={triggerValue}
                  onChange={(e) => setTriggerValue(e.target.value)}
                />
              </div>
            )}

            {triggerType === "WORKFLOW_COMPLETED" && (
              <div className="space-y-2">
                <Label>Triggered by Workflow</Label>
                <Select
                  value={triggeredByWorkflowId || "none"}
                  onValueChange={(v) =>
                    setTriggeredByWorkflowId(v === "none" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {otherWorkflows.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editingWorkflow && (
              <div className="space-y-2">
                <Label>Attachments (screenshots / recordings)</Label>
                <div className="flex flex-wrap gap-2">
                  {editAttachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-2 rounded-md border border-secondary-200 px-3 py-2 text-sm"
                    >
                      {attachment.type === "video" ? (
                        <FileVideo className="size-4 text-secondary-500" />
                      ) : (
                        <FileImage className="size-4 text-secondary-500" />
                      )}
                      <span className="max-w-[150px] truncate">
                        {attachment.filename}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(attachment.id)}
                        className="text-secondary-400 hover:text-danger-500"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 size-4" />
                  )}
                  Upload File
                </Button>
              </div>
            )}

            {error && <p className="text-sm text-danger-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {editingWorkflow ? "Update Workflow" : "Create Workflow"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
