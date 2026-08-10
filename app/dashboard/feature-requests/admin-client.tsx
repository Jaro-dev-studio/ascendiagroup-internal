"use client";

import { useState, useCallback, useMemo } from "react";
import { RequestType, RequestStatus, TaskPriority, BugSeverity } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertCircle,
  Clock,
  Circle,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Check,
  X,
  Lightbulb,
  Bug,
  ExternalLink,
  Calendar,
  Building2,
  User,
  Loader2,
  Ban,
  AlertTriangle,
  Video,
  Trash2,
  Search,
} from "lucide-react";
import { rejectRequest, acceptRequest, deleteRequest } from "@/lib/actions";
import { DataTable, ColumnDef } from "@/components/data-table";

// ============================================
// Types
// ============================================

interface RequestData {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  type: RequestType;
  status: RequestStatus;
  rejectionComment: string | null;
  stepsToReproduce: string | null;
  expectedBehavior: string | null;
  bugSeverity: BugSeverity | null;
  screenRecordingUrl: string | null;
  clientCompany: {
    id: string;
    name: string;
  };
  task: {
    id: string;
    name: string;
    status: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CompanyData {
  id: string;
  name: string;
}

interface UserData {
  id: string;
  email: string;
}

interface TaskData {
  id: string;
  name: string;
  status: string;
  clientCompany: {
    id: string;
    name: string;
  };
}

interface ActionItemData {
  id: string;
  name: string;
  status: string;
  clientCompany: {
    id: string;
    name: string;
  };
}

interface AdminRequestsClientProps {
  requests: RequestData[];
  clientCompanies: CompanyData[];
  users: UserData[];
  tasks: TaskData[];
  actionItems: ActionItemData[];
}

// ============================================
// Config
// ============================================

const priorityConfig = {
  URGENT: { label: "Urgent", color: "bg-danger-100 text-danger-700 border-danger-200", icon: AlertCircle },
  HIGH: { label: "High", color: "bg-warning-100 text-warning-700 border-warning-200", icon: AlertCircle },
  MEDIUM: { label: "Medium", color: "bg-warning-50 text-warning-600 border-warning-100", icon: Clock },
  LOW: { label: "Low", color: "bg-secondary-100 text-secondary-600 border-secondary-200", icon: Circle },
};

const statusConfig = {
  SUBMITTED: { label: "Submitted", color: "bg-primary-100 text-primary-700 border-primary-200", icon: Clock },
  ACCEPTED: { label: "Accepted", color: "bg-success-100 text-success-700 border-success-200", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", color: "bg-danger-100 text-danger-700 border-danger-200", icon: XCircle },
};

const typeConfig = {
  FEATURE: { label: "Feature", color: "bg-primary-100 text-primary-700 border-primary-200", icon: Lightbulb },
  BUG: { label: "Bug", color: "bg-danger-100 text-danger-700 border-danger-200", icon: Bug },
};

const severityConfig = {
  CRITICAL: { label: "Critical", description: "Product doesn't work at all", color: "bg-danger-100 text-danger-700 border-danger-200", icon: AlertTriangle },
  HIGH: { label: "High", description: "Important features broken", color: "bg-warning-100 text-warning-700 border-warning-200", icon: AlertCircle },
  MEDIUM: { label: "Medium", description: "Product works but issue affects users", color: "bg-warning-50 text-warning-600 border-warning-100", icon: Clock },
  LOW: { label: "Low", description: "Cosmetic or low-impact issue", color: "bg-secondary-100 text-secondary-600 border-secondary-200", icon: Circle },
};

// ============================================
// Main Component
// ============================================

export function AdminRequestsClient({ requests: initialRequests, clientCompanies, users, tasks, actionItems }: AdminRequestsClientProps) {
  const [requests, setRequests] = useState<RequestData[]>(initialRequests);

  // Modal states
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBlockerModalOpen, setIsBlockerModalOpen] = useState(false);
  const [blockerSearchQuery, setBlockerSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<RequestData | null>(null);
  const [rejectionComment, setRejectionComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Attachment preview modal
  const [previewAttachment, setPreviewAttachment] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);

  // Task form for accept modal
  const [taskForm, setTaskForm] = useState({
    name: "",
    description: "",
    priority: "MEDIUM" as TaskPriority,
    status: "TODO" as "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE",
    dueDate: undefined as Date | undefined,
    assigneeId: "",
    blockedByTaskIds: [] as string[],
    blockedByActionItemIds: [] as string[],
  });

  // ============================================
  // Column Definitions
  // ============================================

  const columns: ColumnDef<RequestData>[] = useMemo(() => [
    {
      id: "title",
      header: "Request",
      accessorKey: "title",
      width: "w-1/3",
      sortable: true,
      cell: (row) => (
        <p className="text-text-dark truncate font-medium">{row.title}</p>
      ),
    },
    {
      id: "type",
      header: "Type",
      accessorKey: "type",
      sortable: true,
      sortFn: (a, b, direction) => {
        const order = { FEATURE: 0, BUG: 1 };
        const comparison = order[a.type] - order[b.type];
        return direction === "asc" ? comparison : -comparison;
      },
      filterable: true,
      filterType: "multi-select",
      filterOptions: (["FEATURE", "BUG"] as RequestType[]).map((t) => ({
        value: t,
        label: typeConfig[t].label,
        icon: typeConfig[t].icon,
      })),
      cell: (row) => {
        const TypeIcon = typeConfig[row.type].icon;
        return (
          <Badge className={`${typeConfig[row.type].color} whitespace-nowrap border`}>
            <TypeIcon className="mr-1 size-3" />
            {typeConfig[row.type].label}
          </Badge>
        );
      },
    },
    {
      id: "client",
      header: "Client",
      accessorKey: "clientCompany.name",
      width: "w-40",
      sortable: true,
      sortFn: (a, b, direction) => {
        const comparison = a.clientCompany.name.localeCompare(b.clientCompany.name);
        return direction === "asc" ? comparison : -comparison;
      },
      filterable: true,
      filterType: "multi-select",
      filterOptions: clientCompanies.map((c) => ({ value: c.id, label: c.name })),
      filterFn: (row, value) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return true;
        return Array.isArray(value) && value.includes(row.clientCompany.id);
      },
      cell: (row) => (
        <span className="block truncate text-sm text-text-secondary">{row.clientCompany.name}</span>
      ),
    },
    {
      id: "priority",
      header: "Priority",
      accessorKey: "priority",
      sortable: true,
      sortFn: (a, b, direction) => {
        const order = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        const comparison = order[a.priority] - order[b.priority];
        return direction === "asc" ? comparison : -comparison;
      },
      filterable: true,
      filterType: "multi-select",
      filterOptions: (["URGENT", "HIGH", "MEDIUM", "LOW"] as TaskPriority[]).map((p) => ({
        value: p,
        label: priorityConfig[p].label,
        icon: priorityConfig[p].icon,
      })),
      cell: (row) => {
        const PriorityIcon = priorityConfig[row.priority].icon;
        return (
          <Badge className={`${priorityConfig[row.priority].color} whitespace-nowrap border`}>
            <PriorityIcon className="mr-1 size-3" />
            {priorityConfig[row.priority].label}
          </Badge>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      sortable: true,
      sortFn: (a, b, direction) => {
        const order = { SUBMITTED: 0, ACCEPTED: 1, REJECTED: 2 };
        const comparison = order[a.status] - order[b.status];
        return direction === "asc" ? comparison : -comparison;
      },
      filterable: true,
      filterType: "multi-select",
      filterOptions: (["SUBMITTED", "ACCEPTED", "REJECTED"] as RequestStatus[]).map((s) => ({
        value: s,
        label: statusConfig[s].label,
        icon: statusConfig[s].icon,
      })),
      cell: (row) => {
        const StatusIcon = statusConfig[row.status].icon;
        return (
          <Badge className={`${statusConfig[row.status].color} whitespace-nowrap border`}>
            <StatusIcon className="mr-1 size-3" />
            {statusConfig[row.status].label}
          </Badge>
        );
      },
    },
  ], [clientCompanies]);

  // ============================================
  // Handlers
  // ============================================

  const handleViewRequest = useCallback((request: RequestData) => {
    setSelectedRequest(request);
    setIsViewModalOpen(true);
  }, []);

  const handleOpenRejectModal = (request: RequestData) => {
    setIsViewModalOpen(false);
    setSelectedRequest(request);
    setRejectionComment("");
    setIsRejectModalOpen(true);
  };

  const handleOpenDeleteModal = (request: RequestData) => {
    setIsViewModalOpen(false);
    setSelectedRequest(request);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedRequest) return;

    setIsSubmitting(true);
    const result = await deleteRequest(selectedRequest.id);
    setIsSubmitting(false);

    if (result.data) {
      setRequests((prev) => prev.filter((r) => r.id !== selectedRequest.id));
      setIsDeleteModalOpen(false);
      setSelectedRequest(null);
    } else if (result.error) {
      alert(result.error);
    }
  };

  const handleOpenAcceptModal = (request: RequestData) => {
    setSelectedRequest(request);
    
    let taskDescription = request.description || "";
    
    if (request.type === "BUG") {
      const severityLabel = request.bugSeverity ? severityConfig[request.bugSeverity].label : "Unknown";
      const parts: string[] = [];
      
      if (request.description) {
        parts.push(`## Bug Description\n${request.description}`);
      }
      if (request.stepsToReproduce) {
        parts.push(`## Steps to Reproduce\n${request.stepsToReproduce}`);
      }
      if (request.expectedBehavior) {
        parts.push(`## Expected Behavior\n${request.expectedBehavior}`);
      }
      parts.push(`## Severity\n${severityLabel}${request.bugSeverity ? ` - ${severityConfig[request.bugSeverity].description}` : ""}`);
      if (request.screenRecordingUrl) {
        parts.push(`## Screen Recording\n${request.screenRecordingUrl}`);
      }
      taskDescription = parts.join("\n\n");
    }
    
    setTaskForm({
      name: request.title,
      description: taskDescription,
      priority: request.priority,
      status: "TODO",
      dueDate: undefined,
      assigneeId: "",
      blockedByTaskIds: [],
      blockedByActionItemIds: [],
    });
    setIsAcceptModalOpen(true);
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionComment.trim()) return;

    setIsSubmitting(true);
    const result = await rejectRequest(selectedRequest.id, rejectionComment);
    setIsSubmitting(false);

    if (result.data) {
      setRequests((prev) =>
        prev.map((r) => (r.id === selectedRequest.id ? result.data! : r))
      );
      setIsRejectModalOpen(false);
      setSelectedRequest(null);
      setRejectionComment("");
    }
  };

  const handleAccept = async () => {
    if (!selectedRequest || !taskForm.name.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await acceptRequest(selectedRequest.id, {
        name: taskForm.name,
        description: taskForm.description || undefined,
        priority: taskForm.priority,
        status: taskForm.status,
        dueDate: taskForm.dueDate,
        assigneeId: taskForm.assigneeId || undefined,
        blockedByTaskIds: taskForm.blockedByTaskIds,
        blockedByActionItemIds: taskForm.blockedByActionItemIds,
        ...(selectedRequest.type === "BUG" && selectedRequest.screenRecordingUrl && {
          attachmentUrl: selectedRequest.screenRecordingUrl,
          attachmentName: "Screen Recording",
          attachmentType: "video/mp4",
          attachmentSize: 0,
        }),
      });

      if (result.error) {
        console.error("Error accepting request:", result.error);
        alert(result.error);
        return;
      }

      if (result.data) {
        setRequests((prev) =>
          prev.map((r) => (r.id === selectedRequest.id ? result.data!.request : r))
        );
        setIsAcceptModalOpen(false);
        setIsViewModalOpen(false);
        setSelectedRequest(null);
      }
    } catch (error) {
      console.error("Error accepting request:", error);
      alert("Failed to accept request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // Render Actions
  // ============================================

  const renderActions = useCallback((request: RequestData) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {request.status === "SUBMITTED" && (
          <>
            <DropdownMenuItem onClick={() => handleOpenAcceptModal(request)}>
              <Check className="mr-2 size-4" />
              Accept
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleOpenRejectModal(request)}
              className="text-danger-600"
            >
              <X className="mr-2 size-4" />
              Reject
            </DropdownMenuItem>
          </>
        )}
        {request.status === "ACCEPTED" && request.task && (
          <DropdownMenuItem asChild>
            <a href="/dashboard/tasks">
              <ExternalLink className="mr-2 size-4" />
              View Task
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => handleOpenDeleteModal(request)}
          className="text-danger-600"
        >
          <Trash2 className="mr-2 size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ), []);

  // ============================================
  // Custom Search Function
  // ============================================

  const searchFn = useCallback((request: RequestData, query: string) => {
    const q = query.toLowerCase();
    return (
      request.title.toLowerCase().includes(q) ||
      request.clientCompany.name.toLowerCase().includes(q)
    );
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-text-dark text-2xl font-bold">Requests</h1>
        <p className="text-text-secondary">Manage feature requests and bug reports from clients</p>
      </div>

      {/* Data Table */}
      <DataTable
        data={requests}
        columns={columns}
        storageKey="admin-requests"
        searchable
        searchPlaceholder="Search requests..."
        searchFn={searchFn}
        getRowId={(request) => request.id}
        onRowClick={handleViewRequest}
        renderActions={renderActions}
        pageSize={25}
        emptyMessage="No requests yet."
        emptyFilteredMessage="No requests found matching your filters."
      />

      {/* View Request Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-text-secondary">
                  {selectedRequest.type === "BUG" ? "What's the bug?" : "Title"}
                </p>
                <p className="text-text-dark">{selectedRequest.title}</p>
              </div>
              {selectedRequest.description && (
                <div>
                  <p className="text-sm font-medium text-text-secondary">Description</p>
                  <p className="text-text-dark whitespace-pre-wrap">{selectedRequest.description}</p>
                </div>
              )}
              
              {selectedRequest.type === "BUG" && (
                <>
                  {selectedRequest.stepsToReproduce && (
                    <div>
                      <p className="text-sm font-medium text-text-secondary">Steps to Reproduce</p>
                      <p className="text-text-dark whitespace-pre-wrap">{selectedRequest.stepsToReproduce}</p>
                    </div>
                  )}
                  {selectedRequest.expectedBehavior && (
                    <div>
                      <p className="text-sm font-medium text-text-secondary">Expected Behavior</p>
                      <p className="text-text-dark whitespace-pre-wrap">{selectedRequest.expectedBehavior}</p>
                    </div>
                  )}
                  {selectedRequest.screenRecordingUrl && (
                    <div>
                      <p className="text-sm font-medium text-text-secondary">Screen Recording</p>
                      <a
                        href={selectedRequest.screenRecordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-2 text-primary-600 hover:underline"
                      >
                        <Video className="size-4" />
                        View Recording
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  )}
                </>
              )}
              
              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="text-sm font-medium text-text-secondary">Type</p>
                  <Badge className={`${typeConfig[selectedRequest.type].color} mt-1 border`}>
                    {typeConfig[selectedRequest.type].label}
                  </Badge>
                </div>
                {selectedRequest.type === "BUG" && selectedRequest.bugSeverity && (
                  <div>
                    <p className="text-sm font-medium text-text-secondary">Severity</p>
                    <Badge className={`${severityConfig[selectedRequest.bugSeverity].color} mt-1 border`}>
                      {severityConfig[selectedRequest.bugSeverity].label}
                    </Badge>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-text-secondary">Priority</p>
                  <Badge className={`${priorityConfig[selectedRequest.priority].color} mt-1 border`}>
                    {priorityConfig[selectedRequest.priority].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-secondary">Status</p>
                  <Badge className={`${statusConfig[selectedRequest.status].color} mt-1 border`}>
                    {statusConfig[selectedRequest.status].label}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-text-secondary">Client</p>
                <p className="text-text-dark">{selectedRequest.clientCompany.name}</p>
              </div>
              {selectedRequest.status === "REJECTED" && selectedRequest.rejectionComment && (
                <div>
                  <p className="text-sm font-medium text-danger-600">Rejection Reason</p>
                  <p className="text-text-dark whitespace-pre-wrap">{selectedRequest.rejectionComment}</p>
                </div>
              )}
              {selectedRequest.status === "ACCEPTED" && selectedRequest.task && (
                <div>
                  <p className="text-sm font-medium text-text-secondary">Linked Task</p>
                  <a href="/dashboard/tasks" className="text-primary-600 hover:underline">
                    {selectedRequest.task.name}
                  </a>
                </div>
              )}
              {selectedRequest.status === "SUBMITTED" && (
                <div className="flex gap-2 pt-4">
                  <Button onClick={() => handleOpenAcceptModal(selectedRequest)}>
                    <Check className="mr-2 size-4" />
                    Accept
                  </Button>
                  <Button variant="outline" onClick={() => handleOpenRejectModal(selectedRequest)}>
                    <X className="mr-2 size-4" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-text-secondary">
              Please provide a reason for rejecting this request. This will be visible to the client.
            </p>
            <Textarea
              placeholder="Rejection reason..."
              value={rejectionComment}
              onChange={(e) => setRejectionComment(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsRejectModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectionComment.trim() || isSubmitting}
              >
                Reject Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-text-secondary">
              Are you sure you want to delete this request? This action cannot be undone.
            </p>
            {selectedRequest && (
              <div className="rounded-md border border-border bg-secondary-50 p-3">
                <p className="font-medium">{selectedRequest.title}</p>
                <p className="text-sm text-text-secondary">{selectedRequest.clientCompany.name}</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                Delete Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Accept Modal - Task Creation */}
      <Dialog open={isAcceptModalOpen} onOpenChange={setIsAcceptModalOpen}>
        <DialogContent className="flex min-h-[624px] max-w-2xl flex-col p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Accept Request & Create Task</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Building2 className="size-4 text-text-secondary" />
            <span className="text-sm text-text-secondary">{selectedRequest?.clientCompany.name}</span>
            <span className="text-text-secondary">&rsaquo;</span>
            <span className="text-sm font-medium">New task</span>
          </div>

          <div className="flex flex-1 flex-col px-4">
            <Input
              value={taskForm.name}
              onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
              placeholder="Task title"
              className="border-0 px-0 text-xl font-medium shadow-none focus-visible:ring-0"
            />
            <Textarea
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              placeholder="Add description..."
              className="mt-2 flex-1 resize-none border-0 px-0 text-text-secondary shadow-none focus-visible:ring-0"
            />
          </div>

          {selectedRequest?.type === "BUG" && selectedRequest.screenRecordingUrl && (
            <div
              className="mx-4 mb-2 flex cursor-pointer items-center gap-3 rounded-md border border-border bg-secondary-50 p-3 transition-colors hover:bg-secondary-100"
              onClick={() => setPreviewAttachment({
                url: selectedRequest.screenRecordingUrl!,
                type: "video/mp4",
                name: "Screen Recording",
              })}
            >
              <Video className="size-5 text-primary-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">Screen Recording</p>
                <p className="text-xs text-text-secondary">Click to view video</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 p-4">
            <Select
              value={taskForm.status}
              onValueChange={(v) => setTaskForm({ ...taskForm, status: v as "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" })}
            >
              <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3">
                {(() => {
                  const statusIcons = { TODO: Circle, IN_PROGRESS: Clock, BLOCKED: Ban, DONE: CheckCircle2 };
                  const statusLabels = { TODO: "Todo", IN_PROGRESS: "In Progress", BLOCKED: "Blocked", DONE: "Done" };
                  const StatusIcon = statusIcons[taskForm.status];
                  return (
                    <>
                      <StatusIcon className="size-4" />
                      <span className="text-sm">{statusLabels[taskForm.status]}</span>
                    </>
                  );
                })()}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODO"><div className="flex items-center gap-2"><Circle className="size-4" />Todo</div></SelectItem>
                <SelectItem value="IN_PROGRESS"><div className="flex items-center gap-2"><Clock className="size-4" />In Progress</div></SelectItem>
                <SelectItem value="BLOCKED"><div className="flex items-center gap-2"><Ban className="size-4" />Blocked</div></SelectItem>
                <SelectItem value="DONE"><div className="flex items-center gap-2"><CheckCircle2 className="size-4" />Done</div></SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={taskForm.priority}
              onValueChange={(v) => setTaskForm({ ...taskForm, priority: v as TaskPriority })}
            >
              <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3">
                {(() => {
                  const PriorityIcon = priorityConfig[taskForm.priority].icon;
                  return (
                    <>
                      <PriorityIcon className="size-4" />
                      <span className="text-sm">{priorityConfig[taskForm.priority].label}</span>
                    </>
                  );
                })()}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="URGENT"><div className="flex items-center gap-2"><AlertCircle className="size-4" />Urgent</div></SelectItem>
                <SelectItem value="HIGH"><div className="flex items-center gap-2"><AlertCircle className="size-4" />High</div></SelectItem>
                <SelectItem value="MEDIUM"><div className="flex items-center gap-2"><Clock className="size-4" />Medium</div></SelectItem>
                <SelectItem value="LOW"><div className="flex items-center gap-2"><Circle className="size-4" />Low</div></SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={taskForm.assigneeId || "unassigned"}
              onValueChange={(v) => setTaskForm({ ...taskForm, assigneeId: v === "unassigned" ? "" : v })}
            >
              <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3">
                <User className="size-4 text-text-secondary" />
                <span className="text-sm">
                  {taskForm.assigneeId ? users.find((u) => u.id === taskForm.assigneeId)?.email || "Assignee" : "Assignee"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>{user.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex h-8 items-center gap-2 rounded-full border border-border bg-background px-3">
              <Building2 className="size-4 text-text-secondary" />
              <span className="text-sm">{selectedRequest?.clientCompany.name}</span>
            </div>

            <div className="flex h-8 items-center gap-2 rounded-full border border-border bg-background px-3">
              <Calendar className="size-4 text-text-secondary" />
              <input
                type="date"
                value={taskForm.dueDate ? taskForm.dueDate.toISOString().split("T")[0] : ""}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value ? new Date(e.target.value) : undefined })}
                className="border-0 bg-transparent text-sm outline-none"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-2 rounded-full"
              onClick={() => setIsBlockerModalOpen(true)}
            >
              <Ban className="size-4 text-text-secondary" />
              <span className="text-sm">
                {taskForm.blockedByTaskIds.length + taskForm.blockedByActionItemIds.length > 0
                  ? `Blocked by ${taskForm.blockedByTaskIds.length + taskForm.blockedByActionItemIds.length}`
                  : "Add blocker"}
              </span>
            </Button>
          </div>

          {taskForm.status === "BLOCKED" && taskForm.blockedByTaskIds.length === 0 && taskForm.blockedByActionItemIds.length === 0 && (
            <div className="mx-4 mb-4 flex items-center gap-2 rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
              <Ban className="size-4" />
              <span>Please select at least one blocker when status is set to Blocked.</span>
            </div>
          )}

          {(taskForm.blockedByTaskIds.length > 0 || taskForm.blockedByActionItemIds.length > 0) && (
            <div className="flex flex-wrap gap-2 px-4 pb-4">
              {taskForm.blockedByTaskIds.map((taskId) => {
                const blockerTask = tasks.find((t) => t.id === taskId);
                if (!blockerTask) return null;
                return (
                  <Badge key={taskId} variant="outline" className="gap-1">
                    <span className="text-xs">Task: {blockerTask.name}</span>
                    <button
                      type="button"
                      onClick={() => setTaskForm({ ...taskForm, blockedByTaskIds: taskForm.blockedByTaskIds.filter((id) => id !== taskId) })}
                      className="ml-1 hover:text-danger-600"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                );
              })}
              {taskForm.blockedByActionItemIds.map((actionItemId) => {
                const blockerActionItem = actionItems.find((a) => a.id === actionItemId);
                if (!blockerActionItem) return null;
                return (
                  <Badge key={actionItemId} variant="outline" className="gap-1">
                    <span className="text-xs">Action: {blockerActionItem.name}</span>
                    <button
                      type="button"
                      onClick={() => setTaskForm({ ...taskForm, blockedByActionItemIds: taskForm.blockedByActionItemIds.filter((id) => id !== actionItemId) })}
                      className="ml-1 hover:text-danger-600"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3">
            <Button variant="outline" onClick={() => setIsAcceptModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleAccept} 
              disabled={!taskForm.name.trim() || isSubmitting || (taskForm.status === "BLOCKED" && taskForm.blockedByTaskIds.length === 0 && taskForm.blockedByActionItemIds.length === 0)}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Accept & Create Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Blocker Selection Modal */}
      <Dialog open={isBlockerModalOpen} onOpenChange={(open) => { setIsBlockerModalOpen(open); if (!open) setBlockerSearchQuery(""); }}>
        <DialogContent className="flex max-h-[80vh] max-w-lg flex-col">
          <DialogHeader>
            <DialogTitle>Select Blockers</DialogTitle>
            <DialogDescription>Select tasks or action items that block this task from being completed.</DialogDescription>
          </DialogHeader>
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
            <Input placeholder="Search tasks and action items..." value={blockerSearchQuery} onChange={(e) => setBlockerSearchQuery(e.target.value)} className="pl-10" />
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <div>
              <h4 className="mb-2 text-sm font-medium text-text-secondary">Action Items</h4>
              <div className="space-y-1">
                {actionItems.filter((a) => a.name.toLowerCase().includes(blockerSearchQuery.toLowerCase())).sort((a, b) => {
                  const aSelected = taskForm.blockedByActionItemIds.includes(a.id);
                  const bSelected = taskForm.blockedByActionItemIds.includes(b.id);
                  if (aSelected && !bSelected) return -1;
                  if (!aSelected && bSelected) return 1;
                  return 0;
                }).slice(0, 10).map((actionItem) => {
                  const isSelected = taskForm.blockedByActionItemIds.includes(actionItem.id);
                  return (
                    <div
                      key={actionItem.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors ${isSelected ? "border border-primary-200 bg-primary-50" : "hover:bg-secondary-50"}`}
                      onClick={() => {
                        if (isSelected) {
                          setTaskForm({ ...taskForm, blockedByActionItemIds: taskForm.blockedByActionItemIds.filter((id) => id !== actionItem.id) });
                        } else {
                          setTaskForm({ ...taskForm, blockedByActionItemIds: [...taskForm.blockedByActionItemIds, actionItem.id] });
                        }
                      }}
                    >
                      <Circle className="size-4 text-text-secondary" />
                      <div className="flex-1 truncate">
                        <p className="truncate text-sm font-medium">{actionItem.name}</p>
                        <p className="text-xs text-text-secondary">{actionItem.clientCompany.name}</p>
                      </div>
                      {isSelected && <CheckCircle2 className="size-4 text-primary-600" />}
                    </div>
                  );
                })}
                {actionItems.filter((a) => a.name.toLowerCase().includes(blockerSearchQuery.toLowerCase())).length === 0 && (
                  <p className="py-2 text-center text-sm text-text-secondary">No action items found</p>
                )}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium text-text-secondary">Tasks</h4>
              <div className="space-y-1">
                {tasks.filter((t) => t.name.toLowerCase().includes(blockerSearchQuery.toLowerCase())).sort((a, b) => {
                  const aSelected = taskForm.blockedByTaskIds.includes(a.id);
                  const bSelected = taskForm.blockedByTaskIds.includes(b.id);
                  if (aSelected && !bSelected) return -1;
                  if (!aSelected && bSelected) return 1;
                  return 0;
                }).slice(0, 10).map((task) => {
                  const isSelected = taskForm.blockedByTaskIds.includes(task.id);
                  return (
                    <div
                      key={task.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors ${isSelected ? "border border-primary-200 bg-primary-50" : "hover:bg-secondary-50"}`}
                      onClick={() => {
                        if (isSelected) {
                          setTaskForm({ ...taskForm, blockedByTaskIds: taskForm.blockedByTaskIds.filter((id) => id !== task.id) });
                        } else {
                          setTaskForm({ ...taskForm, blockedByTaskIds: [...taskForm.blockedByTaskIds, task.id] });
                        }
                      }}
                    >
                      <Circle className="size-4 text-text-secondary" />
                      <div className="flex-1 truncate">
                        <p className="truncate text-sm font-medium">{task.name}</p>
                        <p className="text-xs text-text-secondary">{task.clientCompany.name}</p>
                      </div>
                      {isSelected && <CheckCircle2 className="size-4 text-primary-600" />}
                    </div>
                  );
                })}
                {tasks.filter((t) => t.name.toLowerCase().includes(blockerSearchQuery.toLowerCase())).length === 0 && (
                  <p className="py-2 text-center text-sm text-text-secondary">No tasks found</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button onClick={() => { setIsBlockerModalOpen(false); setBlockerSearchQuery(""); }}>Done</Button>
            <Button variant="outline" onClick={() => { setIsBlockerModalOpen(false); setBlockerSearchQuery(""); }}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachment Preview Modal */}
      <Dialog open={!!previewAttachment} onOpenChange={(open) => !open && setPreviewAttachment(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{previewAttachment?.name || "Attachment Preview"}</DialogTitle>
          </DialogHeader>
          {previewAttachment && (
            <div className="relative">
              <button
                onClick={() => setPreviewAttachment(null)}
                className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
              >
                <X className="size-4" />
              </button>
              {previewAttachment.type.startsWith("image/") && (
                <div className="flex max-h-[85vh] items-center justify-center bg-black p-4">
                  <img src={previewAttachment.url} alt={previewAttachment.name} className="max-h-[80vh] max-w-full object-contain" />
                </div>
              )}
              {previewAttachment.type.startsWith("video/") && (
                <div className="flex max-h-[85vh] items-center justify-center bg-black p-4">
                  <video src={previewAttachment.url} controls autoPlay className="max-h-[80vh] max-w-full">Your browser does not support the video tag.</video>
                </div>
              )}
              <div className="border-t border-border bg-background px-4 py-3">
                <p className="text-sm text-text-secondary">{previewAttachment.name}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
