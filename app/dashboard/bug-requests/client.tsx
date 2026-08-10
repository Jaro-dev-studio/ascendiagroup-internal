"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { TaskPriority, RequestStatus, BugSeverity } from "@prisma/client";
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
  Bug,
  Upload,
  Video,
  X,
  Loader2,
  ExternalLink,
  AlertTriangle,
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

interface BugRequestsClientProps {
  requests: RequestData[];
  clientCompanyId: string;
  clientCompanyName: string;
}

// ============================================
// Config
// ============================================

const statusConfig = {
  SUBMITTED: { label: "Submitted", color: "bg-primary-100 text-primary-700 border-primary-200", icon: Clock },
  ACCEPTED: { label: "Accepted", color: "bg-success-100 text-success-700 border-success-200", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", color: "bg-danger-100 text-danger-700 border-danger-200", icon: XCircle },
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

export function BugRequestsClient({ requests: initialRequests, clientCompanyId }: BugRequestsClientProps) {
  const [requests, setRequests] = useState<RequestData[]>(initialRequests);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    stepsToReproduce: "",
    expectedBehavior: "",
    bugSeverity: "MEDIUM" as BugSeverity,
    screenRecordingUrl: "",
    screenRecordingName: "",
  });

  // ============================================
  // Column Definitions
  // ============================================

  const columns: ColumnDef<RequestData>[] = useMemo(() => [
    {
      id: "title",
      header: "Bug Report",
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
      id: "severity",
      header: "Severity",
      accessorKey: "bugSeverity",
      sortable: true,
      sortFn: (a, b, direction) => {
        const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        const aSeverity = a.bugSeverity ? order[a.bugSeverity] : 999;
        const bSeverity = b.bugSeverity ? order[b.bugSeverity] : 999;
        const comparison = aSeverity - bSeverity;
        return direction === "asc" ? comparison : -comparison;
      },
      filterable: true,
      filterType: "multi-select",
      filterOptions: (["CRITICAL", "HIGH", "MEDIUM", "LOW"] as BugSeverity[]).map((s) => ({
        value: s,
        label: severityConfig[s].label,
        icon: severityConfig[s].icon,
      })),
      filterFn: (row, value) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return true;
        if (!row.bugSeverity) return false;
        return Array.isArray(value) && value.includes(row.bugSeverity);
      },
      cell: (row) => {
        if (!row.bugSeverity) return null;
        const SeverityIcon = severityConfig[row.bugSeverity].icon;
        return (
          <Badge className={`${severityConfig[row.bugSeverity].color} whitespace-nowrap border`}>
            <SeverityIcon className="mr-1 size-3" />
            {severityConfig[row.bugSeverity].label}
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

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      stepsToReproduce: "",
      expectedBehavior: "",
      bugSeverity: "MEDIUM",
      screenRecordingUrl: "",
      screenRecordingName: "",
    });
    setUploadError(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (request: RequestData) => {
    setSelectedRequest(request);
    setFormData({
      title: request.title,
      description: request.description || "",
      stepsToReproduce: request.stepsToReproduce || "",
      expectedBehavior: request.expectedBehavior || "",
      bugSeverity: request.bugSeverity || "MEDIUM",
      screenRecordingUrl: request.screenRecordingUrl || "",
      screenRecordingName: request.screenRecordingUrl ? "Screen Recording" : "",
    });
    setUploadError(null);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "video/mp4") {
      setUploadError("Only MP4 videos are allowed.");
      return;
    }

    if (file.size > 250 * 1024 * 1024) {
      setUploadError("File too large. Maximum size is 250MB.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const result = await response.json();
      setFormData((prev) => ({
        ...prev,
        screenRecordingUrl: result.url,
        screenRecordingName: result.name,
      }));
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveVideo = () => {
    setFormData((prev) => ({
      ...prev,
      screenRecordingUrl: "",
      screenRecordingName: "",
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isFormValid = () => {
    return (
      formData.title.trim() !== "" &&
      formData.description.trim() !== "" &&
      formData.stepsToReproduce.trim() !== "" &&
      formData.expectedBehavior.trim() !== "" &&
      formData.bugSeverity &&
      formData.screenRecordingUrl.trim() !== ""
    );
  };

  const handleCreate = async () => {
    if (!isFormValid()) return;

    setIsSubmitting(true);
    const result = await createRequest({
      title: formData.title,
      description: formData.description,
      priority: "MEDIUM",
      type: "BUG",
      clientCompanyId,
      stepsToReproduce: formData.stepsToReproduce,
      expectedBehavior: formData.expectedBehavior,
      bugSeverity: formData.bugSeverity,
      screenRecordingUrl: formData.screenRecordingUrl,
    });
    setIsSubmitting(false);

    if (result.data) {
      setRequests((prev) => [result.data as RequestData, ...prev]);
      setIsCreateModalOpen(false);
      resetForm();
    }
  };

  const handleUpdate = async () => {
    if (!selectedRequest || !formData.title.trim()) return;

    setIsSubmitting(true);
    const result = await updateRequest(selectedRequest.id, {
      title: formData.title,
      description: formData.description || undefined,
    });
    setIsSubmitting(false);

    if (result.data) {
      setRequests((prev) =>
        prev.map((r) => (r.id === selectedRequest.id ? result.data as RequestData : r))
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
      <Bug className="size-12 text-secondary-400" />
      <p className="mt-4 text-lg font-medium text-secondary-900">No bug reports yet</p>
      <p className="mt-2 text-secondary-600">Report a bug to get started.</p>
      <Button onClick={handleOpenCreateModal} className="mt-4">
        <Plus className="mr-2 size-4" />
        Report Bug
      </Button>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-text-dark text-2xl font-bold">Bug Fix Requests</h1>
          <p className="text-text-secondary">Report bugs and track their resolution</p>
        </div>
        <Button onClick={handleOpenCreateModal}>
          <Plus className="mr-2 size-4" />
          Report Bug
        </Button>
      </div>

      {/* Data Table */}
      <DataTable
        data={requests}
        columns={columns}
        storageKey="client-bug-requests"
        searchable
        searchPlaceholder="Search bug reports..."
        searchFn={searchFn}
        getRowId={(request) => request.id}
        onRowClick={handleViewRequest}
        pageSize={25}
        emptyMessage={requests.length === 0 ? emptyState : "No bug reports yet."}
        emptyFilteredMessage="No bug reports found matching your filters."
      />

      {/* View Request Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bug Report Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-text-secondary">What&apos;s the bug?</p>
                <p className="text-text-dark">{selectedRequest.title}</p>
              </div>
              {selectedRequest.description && (
                <div>
                  <p className="text-sm font-medium text-text-secondary">Description</p>
                  <p className="text-text-dark whitespace-pre-wrap">{selectedRequest.description}</p>
                </div>
              )}
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
              <div className="flex gap-4">
                {selectedRequest.bugSeverity && (
                  <div>
                    <p className="text-sm font-medium text-text-secondary">Severity</p>
                    <Badge className={`${severityConfig[selectedRequest.bugSeverity].color} mt-1 border`}>
                      {severityConfig[selectedRequest.bugSeverity].label}
                    </Badge>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-text-secondary">Status</p>
                  <Badge className={`${statusConfig[selectedRequest.status].color} mt-1 border`}>
                    {statusConfig[selectedRequest.status].label}
                  </Badge>
                </div>
              </div>
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
              {selectedRequest.status === "REJECTED" && selectedRequest.rejectionComment && (
                <div className="rounded-md border border-danger-200 bg-danger-50 p-3">
                  <p className="text-sm font-medium text-danger-700">Rejection Reason</p>
                  <p className="mt-1 whitespace-pre-wrap text-danger-600">{selectedRequest.rejectionComment}</p>
                </div>
              )}
              {selectedRequest.status === "ACCEPTED" && selectedRequest.task && (
                <div className="rounded-md border border-success-200 bg-success-50 p-3">
                  <p className="text-sm font-medium text-success-700">Bug Report Accepted</p>
                  <p className="mt-1 text-success-600">
                    This bug report has been converted to a task: <strong>{selectedRequest.task.name}</strong>
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

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateModalOpen(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report a Bug</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-text-dark text-sm font-medium">
                What&apos;s the bug? <span className="text-danger-500">*</span>
              </label>
              <Input
                placeholder="Brief description of the bug"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-text-dark text-sm font-medium">
                Describe what&apos;s broken <span className="text-danger-500">*</span>
              </label>
              <Textarea
                placeholder="Describe what is broken in detail..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <label className="text-text-dark text-sm font-medium">
                Steps to Reproduce <span className="text-danger-500">*</span>
              </label>
              <p className="text-xs text-text-secondary">Please provide clear steps to trigger the bug.</p>
              <Textarea
                placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                value={formData.stepsToReproduce}
                onChange={(e) => setFormData({ ...formData, stepsToReproduce: e.target.value })}
                className="mt-1"
                rows={4}
              />
            </div>

            <div>
              <label className="text-text-dark text-sm font-medium">
                Expected Behavior <span className="text-danger-500">*</span>
              </label>
              <Textarea
                placeholder="What should happen instead?"
                value={formData.expectedBehavior}
                onChange={(e) => setFormData({ ...formData, expectedBehavior: e.target.value })}
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <label className="text-text-dark text-sm font-medium">
                Bug Severity <span className="text-danger-500">*</span>
              </label>
              <Select
                value={formData.bugSeverity}
                onValueChange={(v) => setFormData({ ...formData, bugSeverity: v as BugSeverity })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as BugSeverity[]).map((s) => {
                    const Icon = severityConfig[s].icon;
                    return (
                      <SelectItem key={s} value={s}>
                        <div className="flex items-center gap-2">
                          <Icon className="size-3" />
                          <span>{severityConfig[s].label}</span>
                          <span className="text-xs text-text-secondary">- {severityConfig[s].description}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-text-dark text-sm font-medium">
                Screen Recording <span className="text-danger-500">*</span>
              </label>
              <p className="text-xs text-text-secondary">
                If you don&apos;t have a screen recording tool:{" "}
                <a
                  href="https://www.veed.io/tools/screen-recorder"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline"
                >
                  Click here to record your screen for free from the browser
                </a>
              </p>
              
              {formData.screenRecordingUrl ? (
                <div className="mt-2 flex items-center gap-3 rounded-md border border-border bg-secondary-50 p-3">
                  <Video className="size-5 text-primary-600" />
                  <div className="flex-1 truncate">
                    <p className="truncate text-sm font-medium">{formData.screenRecordingName || "Screen Recording"}</p>
                    <a
                      href={formData.screenRecordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-600 hover:underline"
                    >
                      View video
                    </a>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveVideo}
                    className="size-8"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 size-4" />
                        Upload MP4 Video (max 250MB)
                      </>
                    )}
                  </Button>
                  {uploadError && (
                    <p className="mt-2 text-sm text-danger-600">{uploadError}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => {
                setIsCreateModalOpen(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!isFormValid() || isSubmitting || isUploading}
              >
                {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                Submit Bug Report
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsEditModalOpen(false);
          setSelectedRequest(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Bug Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-text-dark text-sm font-medium">Title</label>
              <Input
                placeholder="Brief description of the bug"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-text-dark text-sm font-medium">Description</label>
              <Textarea
                placeholder="Describe the bug in detail..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1"
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => {
                setIsEditModalOpen(false);
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={!formData.title.trim() || isSubmitting}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Bug Report</DialogTitle>
          </DialogHeader>
          <p className="text-text-secondary">
            Are you sure you want to delete this bug report? This action cannot be undone.
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
