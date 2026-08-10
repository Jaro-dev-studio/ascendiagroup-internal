"use client";

import { useState, useRef, useEffect } from "react";
import { TaskPriority, RequestStatus, BugSeverity } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
} from "lucide-react";
import { createRequest, updateRequest, deleteRequest } from "@/lib/actions";

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

interface StudioBugReportClientProps {
  requests: RequestData[];
  clientCompanyId: string;
  clientCompanyName: string;
}

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

const severityConfig = {
  CRITICAL: { label: "Critical", description: "Product doesn't work at all", color: "bg-danger-100 text-danger-700 border-danger-200", icon: AlertTriangle },
  HIGH: { label: "High", description: "Important features broken", color: "bg-warning-100 text-warning-700 border-warning-200", icon: AlertCircle },
  MEDIUM: { label: "Medium", description: "Product works but issue affects users", color: "bg-warning-50 text-warning-600 border-warning-100", icon: Clock },
  LOW: { label: "Low", description: "Cosmetic or low-impact issue", color: "bg-secondary-100 text-secondary-600 border-secondary-200", icon: Circle },
};

type SortColumn = "severity" | "status";
type SortDirection = "asc" | "desc";

const STORAGE_KEY = "studio-bug-report-table-preferences";

interface TablePreferences {
  sortColumn: SortColumn | null;
  sortDirection: SortDirection;
  statusFilters: RequestStatus[];
  severityFilters: BugSeverity[];
}

function loadPreferences(): Partial<TablePreferences> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

export function StudioBugReportClient({ requests: initialRequests, clientCompanyId, clientCompanyName }: StudioBugReportClientProps) {
  const [requests, setRequests] = useState<RequestData[]>(initialRequests);
  const [searchQuery, setSearchQuery] = useState("");

  // Load persisted preferences
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(() => {
    const prefs = loadPreferences();
    return prefs.sortColumn ?? null;
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const prefs = loadPreferences();
    return prefs.sortDirection || "asc";
  });
  const [statusFilters, setStatusFilters] = useState<RequestStatus[]>(() => {
    const prefs = loadPreferences();
    return prefs.statusFilters || [];
  });
  const [severityFilters, setSeverityFilters] = useState<BugSeverity[]>(() => {
    const prefs = loadPreferences();
    return prefs.severityFilters || [];
  });

  // Persist preferences to localStorage
  useEffect(() => {
    const prefs: TablePreferences = {
      sortColumn,
      sortDirection,
      statusFilters,
      severityFilters,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [sortColumn, sortDirection, statusFilters, severityFilters]);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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

  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const statusOrder = { SUBMITTED: 0, ACCEPTED: 1, REJECTED: 2 };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortColumn(null);
        setSortDirection("asc");
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-1 inline size-3 text-text-secondary" />;
    if (sortDirection === "asc") return <ArrowUp className="ml-1 inline size-3" />;
    return <ArrowDown className="ml-1 inline size-3" />;
  };

  const toggleStatusFilter = (status: RequestStatus) => {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const toggleSeverityFilter = (severity: BugSeverity) => {
    setSeverityFilters((prev) =>
      prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity]
    );
  };

  const hasActiveFilters = statusFilters.length > 0 || severityFilters.length > 0;

  const clearFilters = () => {
    setStatusFilters([]);
    setSeverityFilters([]);
  };

  const filteredRequests = requests
    .filter((request) => {
      const matchesSearch = request.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilters.length === 0 || statusFilters.includes(request.status);
      const matchesSeverity = severityFilters.length === 0 || (request.bugSeverity && severityFilters.includes(request.bugSeverity));
      return matchesSearch && matchesStatus && matchesSeverity;
    })
    .sort((a, b) => {
      // Default sort by most recently created
      if (!sortColumn) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      let comparison = 0;
      if (sortColumn === "status") {
        comparison = statusOrder[a.status] - statusOrder[b.status];
      } else if (sortColumn === "severity") {
        const aSeverity = a.bugSeverity ? severityOrder[a.bugSeverity] : 999;
        const bSeverity = b.bugSeverity ? severityOrder[b.bugSeverity] : 999;
        comparison = aSeverity - bSeverity;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

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

  const handleViewRequest = (request: RequestData) => {
    setSelectedRequest(request);
    setIsViewModalOpen(true);
  };

  const handleOpenDeleteModal = (request: RequestData) => {
    setSelectedRequest(request);
    setIsDeleteModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== "video/mp4") {
      setUploadError("Only MP4 videos are allowed.");
      return;
    }

    // Validate file size (250MB)
    if (file.size > 250 * 1024 * 1024) {
      setUploadError("File too large. Maximum size is 250MB.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

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
      setUploadProgress(100);
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
      priority: "MEDIUM", // Default priority, severity is the main indicator for bugs
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

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-text-dark text-2xl font-bold">Studio Platform Bug Report</h1>
          <p className="text-text-secondary">Report bugs in the Jaro.dev Studio platform</p>
        </div>
        <Button onClick={handleOpenCreateModal}>
          <Plus className="mr-2 size-4" />
          Report Bug
        </Button>
      </div>

      {/* Table with Integrated Toolbar */}
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        {/* Integrated Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border bg-background-secondary/30 p-3">
          {/* Top row: Search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                placeholder="Search bug reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-text-secondary focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Bottom row: Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">Filters</span>
            <div className="h-4 w-px bg-border"></div>

            {/* Status Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm transition-colors hover:bg-background-secondary/50">
                  Status
                  {statusFilters.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {statusFilters.length}
                    </Badge>
                  )}
                  <ChevronDown className="size-3 text-text-secondary" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-48 p-2">
                <div className="flex flex-col gap-1">
                  {(Object.keys(statusConfig) as RequestStatus[]).map((status) => {
                    const StatusIcon = statusConfig[status].icon;
                    return (
                      <label
                        key={status}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-background-secondary/50"
                      >
                        <Checkbox
                          checked={statusFilters.includes(status)}
                          onCheckedChange={() => toggleStatusFilter(status)}
                        />
                        <StatusIcon className="size-3 text-text-secondary" />
                        <span className="text-sm">{statusConfig[status].label}</span>
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {/* Severity Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm transition-colors hover:bg-background-secondary/50">
                  Severity
                  {severityFilters.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {severityFilters.length}
                    </Badge>
                  )}
                  <ChevronDown className="size-3 text-text-secondary" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-48 p-2">
                <div className="flex flex-col gap-1">
                  {(Object.keys(severityConfig) as BugSeverity[]).map((severity) => {
                    const SeverityIcon = severityConfig[severity].icon;
                    return (
                      <label
                        key={severity}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-background-secondary/50"
                      >
                        <Checkbox
                          checked={severityFilters.includes(severity)}
                          onCheckedChange={() => toggleSeverityFilter(severity)}
                        />
                        <SeverityIcon className="size-3 text-text-secondary" />
                        <span className="text-sm">{severityConfig[severity].label}</span>
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="hover:text-text-dark flex h-7 items-center gap-1 rounded-md px-2 text-xs text-text-secondary transition-colors hover:bg-background"
              >
                <X className="size-3" />
                Clear
              </button>
            )}

            <div className="ml-auto text-xs text-text-secondary">
              {filteredRequests.length} {filteredRequests.length === 1 ? "report" : "reports"}
            </div>
          </div>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bug Report</TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-background-secondary/50"
                onClick={() => handleSort("severity")}
              >
                <span className="flex items-center">
                  Severity
                  {getSortIcon("severity")}
                </span>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-background-secondary/50"
                onClick={() => handleSort("status")}
              >
                <span className="flex items-center">
                  Status
                  {getSortIcon("status")}
                </span>
              </TableHead>
              <TableHead>Rejection Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-text-secondary">
                  {searchQuery || hasActiveFilters
                    ? "No bug reports found matching your filters."
                    : (
                      <div className="flex flex-col items-center">
                        <Bug className="size-12 text-secondary-400" />
                        <p className="mt-4 text-lg font-medium text-secondary-900">No bug reports yet</p>
                        <p className="mt-2 text-secondary-600">Report a bug in the Studio platform to get started.</p>
                        <Button onClick={handleOpenCreateModal} className="mt-4">
                          <Plus className="mr-2 size-4" />
                          Report Bug
                        </Button>
                      </div>
                    )}
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request) => {
                const StatusIcon = statusConfig[request.status].icon;
                const SeverityIcon = request.bugSeverity ? severityConfig[request.bugSeverity].icon : Circle;
                return (
                  <TableRow
                    key={request.id}
                    className="cursor-pointer hover:bg-secondary-50"
                    onClick={() => handleViewRequest(request)}
                  >
                    <TableCell className="max-w-[500px]">
                      <p className="text-text-dark truncate font-medium">{request.title}</p>
                      {request.description && (
                        <p className="mt-1 truncate text-sm text-text-secondary">{request.description}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {request.bugSeverity && (
                        <Badge className={`${severityConfig[request.bugSeverity].color} whitespace-nowrap border`}>
                          <SeverityIcon className="mr-1 size-3" />
                          {severityConfig[request.bugSeverity].label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusConfig[request.status].color} whitespace-nowrap border`}>
                        <StatusIcon className="mr-1 size-3" />
                        {statusConfig[request.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {request.status === "REJECTED" && request.rejectionComment ? (
                        <p className="truncate text-sm text-danger-600">{request.rejectionComment}</p>
                      ) : (
                        <span className="text-sm text-text-secondary">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

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
            <DialogTitle>Report a Studio Platform Bug</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* What's the bug? */}
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

            {/* Describe what's broken */}
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

            {/* Steps to Reproduce */}
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

            {/* Expected Behavior */}
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

            {/* Bug Severity */}
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

            {/* Screen Recording */}
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
