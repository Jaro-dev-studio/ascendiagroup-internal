"use client";

import { useState, useCallback, useMemo } from "react";
import { TaskPriority, RequestStatus } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import {
  AlertCircle,
  Clock,
  Circle,
  CheckCircle2,
  XCircle,
  Plus,
  Pencil,
  Trash2,
  Lightbulb,
} from "lucide-react";
import { createRequest, updateRequest, deleteRequest } from "@/lib/actions";
import { DataTable, ColumnDef } from "@/components/data-table";

// ============================================
// Types
// ============================================

interface RequestData {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: RequestStatus;
  rejectionComment: string | null;
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

interface FeatureRequestsClientProps {
  requests: RequestData[];
  clientCompanyId: string;
  clientCompanyName: string;
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

// ============================================
// Main Component
// ============================================

export function FeatureRequestsClient({ requests: initialRequests, clientCompanyId }: FeatureRequestsClientProps) {
  const [requests, setRequests] = useState<RequestData[]>(initialRequests);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as TaskPriority,
  });

  // ============================================
  // Column Definitions
  // ============================================

  const columns: ColumnDef<RequestData>[] = useMemo(() => [
    {
      id: "title",
      header: "Request",
      accessorKey: "title",
      sortable: true,
      cell: (row) => (
        <div>
          <p className="text-text-dark truncate font-medium">{row.title}</p>
          {row.description && (
            <p className="mt-1 truncate text-sm text-text-secondary">{row.description}</p>
          )}
        </div>
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
    {
      id: "rejectionComment",
      header: "Rejection Reason",
      accessorKey: "rejectionComment",
      width: "max-w-[200px]",
      cell: (row) => {
        if (row.status === "REJECTED" && row.rejectionComment) {
          return <p className="truncate text-sm text-danger-600">{row.rejectionComment}</p>;
        }
        return <span className="text-sm text-text-secondary">-</span>;
      },
    },
  ], []);

  // ============================================
  // Handlers
  // ============================================

  const handleOpenCreateModal = () => {
    setFormData({ title: "", description: "", priority: "MEDIUM" });
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (request: RequestData) => {
    setSelectedRequest(request);
    setFormData({
      title: request.title,
      description: request.description || "",
      priority: request.priority,
    });
    setIsEditModalOpen(true);
  };

  const handleViewRequest = useCallback((request: RequestData) => {
    setSelectedRequest(request);
    setIsViewModalOpen(true);
  }, []);

  const handleOpenDeleteModal = (request: RequestData) => {
    setSelectedRequest(request);
    setIsDeleteModalOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) return;

    setIsSubmitting(true);
    const result = await createRequest({
      title: formData.title,
      description: formData.description || undefined,
      priority: formData.priority,
      type: "FEATURE",
      clientCompanyId,
    });
    setIsSubmitting(false);

    if (result.data) {
      setRequests((prev) => [result.data!, ...prev]);
      setIsCreateModalOpen(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRequest || !formData.title.trim()) return;

    setIsSubmitting(true);
    const result = await updateRequest(selectedRequest.id, {
      title: formData.title,
      description: formData.description || undefined,
      priority: formData.priority,
    });
    setIsSubmitting(false);

    if (result.data) {
      setRequests((prev) =>
        prev.map((r) => (r.id === selectedRequest.id ? result.data! : r))
      );
      setIsEditModalOpen(false);
      setSelectedRequest(null);
    }
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
    }
  };

  // ============================================
  // Custom Search Function
  // ============================================

  const searchFn = useCallback((request: RequestData, query: string) => {
    return request.title.toLowerCase().includes(query.toLowerCase());
  }, []);

  // ============================================
  // Custom Empty State
  // ============================================

  const emptyState = (
    <div className="flex flex-col items-center py-8">
      <Lightbulb className="size-12 text-secondary-400" />
      <p className="mt-4 text-lg font-medium text-secondary-900">No feature requests yet</p>
      <p className="mt-2 text-secondary-600">Create your first feature request to get started.</p>
      <Button onClick={handleOpenCreateModal} className="mt-4">
        <Plus className="mr-2 size-4" />
        New Request
      </Button>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-text-dark text-2xl font-bold">Feature Requests</h1>
          <p className="text-text-secondary">Request new features for your project</p>
        </div>
        <Button onClick={handleOpenCreateModal}>
          <Plus className="mr-2 size-4" />
          New Request
        </Button>
      </div>

      {/* Data Table */}
      <DataTable
        data={requests}
        columns={columns}
        storageKey="client-feature-requests"
        searchable
        searchPlaceholder="Search requests..."
        searchFn={searchFn}
        getRowId={(request) => request.id}
        onRowClick={handleViewRequest}
        pageSize={25}
        emptyMessage={requests.length === 0 ? emptyState : "No feature requests yet."}
        emptyFilteredMessage="No requests found matching your filters."
      />

      {/* View Request Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-text-secondary">Title</p>
                <p className="text-text-dark">{selectedRequest.title}</p>
              </div>
              {selectedRequest.description && (
                <div>
                  <p className="text-sm font-medium text-text-secondary">Description</p>
                  <p className="text-text-dark whitespace-pre-wrap">{selectedRequest.description}</p>
                </div>
              )}
              <div className="flex gap-4">
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
              {selectedRequest.status === "REJECTED" && selectedRequest.rejectionComment && (
                <div className="rounded-md border border-danger-200 bg-danger-50 p-3">
                  <p className="text-sm font-medium text-danger-700">Rejection Reason</p>
                  <p className="mt-1 whitespace-pre-wrap text-danger-600">{selectedRequest.rejectionComment}</p>
                </div>
              )}
              {selectedRequest.status === "ACCEPTED" && selectedRequest.task && (
                <div className="rounded-md border border-success-200 bg-success-50 p-3">
                  <p className="text-sm font-medium text-success-700">Request Accepted</p>
                  <p className="mt-1 text-success-600">
                    This request has been converted to a task: <strong>{selectedRequest.task.name}</strong>
                  </p>
                </div>
              )}
              {selectedRequest.status === "SUBMITTED" && (
                <div className="flex gap-2 pt-4">
                  <Button onClick={() => {
                    setIsViewModalOpen(false);
                    handleOpenEditModal(selectedRequest);
                  }}>
                    <Pencil className="mr-2 size-4" />
                    Edit
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setIsViewModalOpen(false);
                    handleOpenDeleteModal(selectedRequest);
                  }}>
                    <Trash2 className="mr-2 size-4" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Modal */}
      <Dialog open={isCreateModalOpen || isEditModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          setSelectedRequest(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditModalOpen ? "Edit Request" : "New Feature Request"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-text-dark text-sm font-medium">Title</label>
              <Input
                placeholder="Feature request title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-text-dark text-sm font-medium">Description</label>
              <Textarea
                placeholder="Describe the feature you'd like to see..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1"
                rows={4}
              />
            </div>
            <div>
              <label className="text-text-dark text-sm font-medium">Priority</label>
              <Select
                value={formData.priority}
                onValueChange={(v) => setFormData({ ...formData, priority: v as TaskPriority })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["URGENT", "HIGH", "MEDIUM", "LOW"] as TaskPriority[]).map((p) => {
                    const Icon = priorityConfig[p].icon;
                    return (
                      <SelectItem key={p} value={p}>
                        <div className="flex items-center gap-2">
                          <Icon className="size-3" />
                          {priorityConfig[p].label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => {
                setIsCreateModalOpen(false);
                setIsEditModalOpen(false);
              }}>
                Cancel
              </Button>
              <Button
                onClick={isEditModalOpen ? handleUpdate : handleCreate}
                disabled={!formData.title.trim() || isSubmitting}
              >
                {isEditModalOpen ? "Save Changes" : "Submit Request"}
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
          <p className="text-text-secondary">
            Are you sure you want to delete this request? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
