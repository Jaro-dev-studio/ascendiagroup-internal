"use client";

import { useState, useEffect } from "react";
import { createId } from "@paralleldrive/cuid2";
import { TaskPriority, TaskStatus } from "@prisma/client";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Building2,
  User,
  Calendar,
  AlertCircle,
  Clock,
  Circle,
  Ban,
  CheckCircle2,
  Loader2,
  Eye,
} from "lucide-react";
import { JARO_DEV_INTERNAL_CLIENT_ID } from "@/lib/constants";

interface CompanyData {
  id: string;
  name: string;
}

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
}

export interface CreateTaskFormData {
  clientCompanies: CompanyData[];
  users: UserData[];
}

export interface CreateTaskPayload {
  id: string;
  name: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: Date;
  clientCompanyId: string;
  assigneeId?: string;
}

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefetchedData: CreateTaskFormData | null;
  isDataLoading: boolean;
  dataError: string | null;
  onRetry: () => void;
  onSave: (payload: CreateTaskPayload) => void;
}

const priorityConfig = {
  URGENT: { label: "Urgent", icon: AlertCircle },
  HIGH: { label: "High", icon: AlertCircle },
  MEDIUM: { label: "Medium", icon: Clock },
  LOW: { label: "Low", icon: Circle },
};

const statusConfig = {
  PENDING_ADMIN_REVIEW: { label: "Pending Review", icon: Eye },
  TODO: { label: "Todo", icon: Circle },
  IN_PROGRESS: { label: "In Progress", icon: Clock },
  BLOCKED: { label: "Blocked", icon: Ban },
  DONE: { label: "Done", icon: CheckCircle2 },
};

export function CreateTaskModal({
  isOpen,
  onClose,
  prefetchedData,
  isDataLoading,
  dataError,
  onRetry,
  onSave,
}: CreateTaskModalProps) {
  const clientCompanies = prefetchedData?.clientCompanies || [];
  const users = prefetchedData?.users || [];

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    priority: "MEDIUM" as TaskPriority,
    status: "TODO" as TaskStatus,
    dueDate: "",
    clientCompanyId: "",
    assigneeId: "",
  });

  // Set default client company to Jaro.dev Internal when prefetched data is available
  useEffect(() => {
    if (prefetchedData?.clientCompanies?.length && !formData.clientCompanyId) {
      // Default to Jaro.dev Internal if it exists, otherwise fall back to first client
      const jaroDevInternal = prefetchedData.clientCompanies.find(
        (c) => c.id === JARO_DEV_INTERNAL_CLIENT_ID
      );
      setFormData((prev) => ({
        ...prev,
        clientCompanyId: jaroDevInternal?.id || prefetchedData.clientCompanies[0].id,
      }));
    }
  }, [prefetchedData, formData.clientCompanyId]);

  const handleClose = () => {
    const jaroDevInternal = clientCompanies.find((c) => c.id === JARO_DEV_INTERNAL_CLIENT_ID);
    setFormData({
      name: "",
      description: "",
      priority: "MEDIUM",
      status: "TODO",
      dueDate: "",
      clientCompanyId: jaroDevInternal?.id || clientCompanies[0]?.id || "",
      assigneeId: "",
    });
    onClose();
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.clientCompanyId) return;

    const taskId = createId();
    const payload: CreateTaskPayload = {
      id: taskId,
      name: formData.name,
      description: formData.description || undefined,
      priority: formData.priority,
      status: formData.status,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
      clientCompanyId: formData.clientCompanyId,
      assigneeId: formData.assigneeId || undefined,
    };

    // Close immediately and save in background
    handleClose();
    onSave(payload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="flex min-h-[400px] max-w-2xl flex-col p-0">
        {isDataLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary-600" />
          </div>
        ) : dataError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
            <p className="text-danger-600">{dataError}</p>
            <Button onClick={onRetry}>Retry</Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Building2 className="size-4 text-text-secondary" />
              <span className="text-sm text-text-secondary">
                {clientCompanies.find((c) => c.id === formData.clientCompanyId)?.name || "Select client"}
              </span>
              <span className="text-text-secondary">›</span>
              <span className="text-sm font-medium">New task</span>
            </div>

            {/* Title & Description */}
            <div className="flex flex-1 flex-col px-4">
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Task title"
                className="border-0 px-0 text-xl font-medium shadow-none focus-visible:ring-0"
                autoFocus
              />
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add description..."
                className="mt-2 flex-1 resize-none border-0 px-0 text-text-secondary shadow-none focus-visible:ring-0"
              />
            </div>

            {/* Properties Row */}
            <div className="flex flex-wrap items-center gap-2 p-4">
              {/* Status */}
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as TaskStatus })}
              >
                <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3">
                  {(() => {
                    const StatusIcon = statusConfig[formData.status].icon;
                    return <StatusIcon className="size-4" />;
                  })()}
                  <span className="text-sm">{statusConfig[formData.status].label}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">
                    <div className="flex items-center gap-2">
                      <Circle className="size-4" />
                      Todo
                    </div>
                  </SelectItem>
                  <SelectItem value="IN_PROGRESS">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4" />
                      In Progress
                    </div>
                  </SelectItem>
                  <SelectItem value="BLOCKED">
                    <div className="flex items-center gap-2">
                      <Ban className="size-4" />
                      Blocked
                    </div>
                  </SelectItem>
                  <SelectItem value="DONE">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4" />
                      Done
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Priority */}
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value as TaskPriority })}
              >
                <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3">
                  {(() => {
                    const PriorityIcon = priorityConfig[formData.priority].icon;
                    return (
                      <>
                        <PriorityIcon className="size-4" />
                        <span className="text-sm">{priorityConfig[formData.priority].label}</span>
                      </>
                    );
                  })()}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="URGENT">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="size-4" />
                      Urgent
                    </div>
                  </SelectItem>
                  <SelectItem value="HIGH">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="size-4" />
                      High
                    </div>
                  </SelectItem>
                  <SelectItem value="MEDIUM">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4" />
                      Medium
                    </div>
                  </SelectItem>
                  <SelectItem value="LOW">
                    <div className="flex items-center gap-2">
                      <Circle className="size-4" />
                      Low
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Assignee */}
              <Select
                value={formData.assigneeId || "unassigned"}
                onValueChange={(value) =>
                  setFormData({ ...formData, assigneeId: value === "unassigned" ? "" : value })
                }
              >
                <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3">
                  <User className="size-4 text-text-secondary" />
                  <span className="text-sm">
                    {formData.assigneeId
                      ? (() => {
                        const user = users.find((u) => u.id === formData.assigneeId);
                        return user?.firstName || user?.email || "Assignee";
                      })()
                      : "Assignee"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Client Company */}
              <Select
                value={formData.clientCompanyId}
                onValueChange={(value) => setFormData({ ...formData, clientCompanyId: value })}
              >
                <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3">
                  <Building2 className="size-4 text-text-secondary" />
                  <span className="text-sm">
                    {formData.clientCompanyId
                      ? clientCompanies.find((c) => c.id === formData.clientCompanyId)?.name || "Client"
                      : "Client"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {clientCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Due Date */}
              <div className="flex h-8 items-center gap-2 rounded-full border border-border bg-background px-3">
                <Calendar className="size-4 text-text-secondary" />
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="border-0 bg-transparent text-sm outline-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.name || !formData.clientCompanyId}
              >
                Create task
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
