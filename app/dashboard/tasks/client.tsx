"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createId } from "@paralleldrive/cuid2";
import { CompanyStatus, TaskPriority, TaskStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
  User,
  Building2,
  AlertCircle,
  Clock,
  CheckCircle2,
  Circle,
  Ban,
  X,
  Paperclip,
  FileText,
  Image,
  Video,
  Loader2,
  Bot,
  ExternalLink,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { createTask, updateTask, deleteTask, deleteAttachment, createTaskView, updateTaskView, deleteTaskView, TaskViewData, executeTaskWithAgent, syncTaskAgentExecutionStatus } from "@/lib/actions";
import { DataTable, ColumnDef, ViewData, FilterState } from "@/components/data-table";
import { GitBranch, Play, RefreshCw } from "lucide-react";

// ============================================
// Type Definitions
// ============================================

interface BlockerData {
  id: string;
  name: string;
  status: TaskStatus;
}

interface AttachmentData {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

interface MeetingData {
  id: string;
  title: string;
  clientCompanyId: string | null;
}

interface AgentExecutionData {
  id: string;
  githubRepoName: string;
  githubRepoUrl: string;
  prompt: string;
  cursorAgentId: string;
  cursorAgentUrl: string;
  cursorAgentStatus: string;
  prUrl: string | null;
  prNumber: number | null;
  branchName: string | null;
  summary: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface GitHubRepo {
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  isPrivate: boolean;
  updatedAt: string;
  pushedAt: string;
  defaultBranch: string;
}

interface TaskData {
  id: string;
  name: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date | null;
  clientCompanyId: string;
  clientCompany: {
    id: string;
    name: string;
  };
  assigneeId: string | null;
  assignee: {
    id: string;
    email: string;
  } | null;
  blockedByTasks?: BlockerData[];
  blockedByActionItems?: BlockerData[];
  attachments?: AttachmentData[];
  agentExecutions?: AgentExecutionData[];
  createdById?: string | null;
  createdBy?: {
    id: string;
    email: string;
    firstName: string | null;
  } | null;
  createdByJaroDevAutomation?: boolean;
  meetingId?: string | null;
  meeting?: MeetingData | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ActionItemData {
  id: string;
  name: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  clientCompanyId: string;
  clientCompany: {
    id: string;
    name: string;
  };
}

interface CompanyData {
  id: string;
  name: string;
  status: CompanyStatus;
  _count: {
    users: number;
  };
}

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  role: string;
}

interface TasksClientProps {
  tasks: TaskData[];
  clientCompanies: CompanyData[];
  users: UserData[];
  actionItems: ActionItemData[];
  savedViews: TaskViewData[];
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
  PENDING_ADMIN_REVIEW: { label: "Pending Review", color: "bg-warning-100 text-warning-700 border-warning-200", icon: Eye },
  TODO: { label: "Todo", color: "bg-secondary-100 text-secondary-600 border-secondary-200", icon: Circle },
  IN_PROGRESS: { label: "In Progress", color: "bg-primary-100 text-primary-700 border-primary-200", icon: Clock },
  BLOCKED: { label: "Blocked", color: "bg-danger-100 text-danger-700 border-danger-200", icon: Ban },
  DONE: { label: "Done", color: "bg-success-100 text-success-700 border-success-200", icon: CheckCircle2 },
};

// ============================================
// Main Component
// ============================================

export function TasksClient({ tasks: initialTasks, clientCompanies, users, actionItems, savedViews: initialSavedViews }: TasksClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Filter to only show PURCHASED (converted) clients in create/edit dropdowns
  const purchasedClientCompanies = useMemo(
    () => clientCompanies.filter((c) => c.status === "PURCHASED"),
    [clientCompanies]
  );

  // Parse highlight query param
  const highlightParam = searchParams?.get("highlight");
  const highlightIds = useMemo(() => highlightParam ? highlightParam.split(",") : [], [highlightParam]);

  // Parse status query param for filtering (e.g., /dashboard/tasks?status=BLOCKED)
  const statusParam = searchParams?.get("status");
  const urlFilters = useMemo(() => {
    if (statusParam) {
      // Support comma-separated statuses
      const statuses = statusParam.split(",");
      return { status: statuses };
    }
    return undefined;
  }, [statusParam]);

  const [tasks, setTasks] = useState<TaskData[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBlockerModalOpen, setIsBlockerModalOpen] = useState(false);
  const [blockerSearchQuery, setBlockerSearchQuery] = useState("");

  // Track which highlight we've already opened to prevent re-opening
  const handledHighlightRef = useRef<string | null>(null);

  // Saved views state
  const [savedViews, setSavedViews] = useState<TaskViewData[]>(initialSavedViews);

  // Attachment states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [newAttachments, setNewAttachments] = useState<Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>>([]);
  const [attachmentsToDelete, setAttachmentsToDelete] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Attachment preview modal
  const [previewAttachment, setPreviewAttachment] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);

  // Agent execution states
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [isExecutingAgent, setIsExecutingAgent] = useState(false);
  const [repoSearchQuery, setRepoSearchQuery] = useState("");

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    priority: "MEDIUM" as TaskPriority,
    status: "TODO" as TaskStatus,
    dueDate: "",
    clientCompanyId: "",
    assigneeId: "",
    blockedByTaskIds: [] as string[],
    blockedByActionItemIds: [] as string[],
  });

  // ============================================
  // Column Definitions for DataTable
  // ============================================

  const columns: ColumnDef<TaskData>[] = useMemo(() => [
    {
      id: "name",
      header: "Task",
      accessorKey: "name",
      width: "w-2/5",
      sortable: true,
      cell: (row) => (
        <p className="text-text-dark truncate font-medium">{row.name}</p>
      ),
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
        return Array.isArray(value) && value.includes(row.clientCompanyId);
      },
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Building2 className="size-4 shrink-0 text-text-secondary" />
          <span className="truncate text-sm">{row.clientCompany.name}</span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      sortable: true,
      sortFn: (a, b, direction) => {
        const order = { PENDING_ADMIN_REVIEW: -1, TODO: 0, IN_PROGRESS: 1, BLOCKED: 2, DONE: 3 };
        const comparison = order[a.status] - order[b.status];
        return direction === "asc" ? comparison : -comparison;
      },
      filterable: true,
      filterType: "multi-select",
      filterOptions: (["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as TaskStatus[]).map((s) => ({
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
      id: "assignee",
      header: "Assignee",
      accessorKey: "assignee.email",
      sortable: true,
      sortFn: (a, b, direction) => {
        const aEmail = a.assignee?.email || "";
        const bEmail = b.assignee?.email || "";
        const comparison = aEmail.localeCompare(bEmail);
        return direction === "asc" ? comparison : -comparison;
      },
      filterable: true,
      filterType: "multi-select",
      filterOptions: [
        { value: "unassigned", label: "Unassigned" },
        ...users.map((u) => ({ value: u.id, label: u.firstName || u.email })),
      ],
      filterFn: (row, value) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return true;
        if (Array.isArray(value)) {
          if (value.includes("unassigned") && !row.assigneeId) return true;
          if (row.assigneeId && value.includes(row.assigneeId)) return true;
        }
        return false;
      },
      cell: (row) => (
        row.assignee ? (
          <div className="flex max-w-[180px] items-center gap-2">
            <User className="size-4 shrink-0 text-text-secondary" />
            <span className="truncate text-sm">{row.assignee.email}</span>
          </div>
        ) : (
          <span className="text-sm text-text-secondary">Unassigned</span>
        )
      ),
    },
    {
      id: "createdBy",
      header: "Created By",
      accessorKey: "createdById",
      filterable: true,
      filterType: "multi-select",
      filterOptions: [
        { value: "automation", label: "Jaro.dev Automation" },
        ...users.map((u) => ({ value: u.id, label: u.firstName || u.email })),
      ],
      filterFn: (row, value) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return true;
        if (Array.isArray(value)) {
          if (value.includes("automation") && row.createdByJaroDevAutomation) return true;
          if (row.createdById && value.includes(row.createdById)) return true;
        }
        return false;
      },
      showInBoard: false,
      cell: () => null, // Hidden in table, only used for filtering
    },
    {
      id: "agentExecution",
      header: "Agent Execution",
      accessorKey: "agentExecutions",
      filterable: true,
      filterType: "multi-select",
      filterOptions: [
        { value: "has_execution", label: "Has Agent Execution", icon: Bot },
        { value: "no_execution", label: "No Agent Execution" },
        { value: "active_agent", label: "Agent Running", icon: Clock },
        { value: "completed_agent", label: "Agent Completed", icon: CheckCircle2 },
        { value: "failed_agent", label: "Agent Failed", icon: AlertCircle },
      ],
      filterFn: (row, value) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return true;
        if (!Array.isArray(value)) return true;

        const executions = row.agentExecutions || [];
        const hasExecution = executions.length > 0;
        const hasActiveAgent = executions.some(
          (e) => e.cursorAgentStatus === "CREATING" || e.cursorAgentStatus === "RUNNING"
        );
        const hasCompletedAgent = executions.some(
          (e) => e.cursorAgentStatus === "FINISHED"
        );
        const hasFailedAgent = executions.some(
          (e) => e.cursorAgentStatus === "ERROR" || e.cursorAgentStatus === "STOPPED"
        );

        // Check if any of the selected filters match
        for (const filterValue of value) {
          if (filterValue === "has_execution" && hasExecution) return true;
          if (filterValue === "no_execution" && !hasExecution) return true;
          if (filterValue === "active_agent" && hasActiveAgent) return true;
          if (filterValue === "completed_agent" && hasCompletedAgent) return true;
          if (filterValue === "failed_agent" && hasFailedAgent) return true;
        }
        return false;
      },
      showInBoard: false,
      cell: () => null, // Hidden in table, only used for filtering
    },
    {
      id: "dueDate",
      header: "Due Date",
      accessorKey: "dueDate",
      sortable: true,
      sortFn: (a, b, direction) => {
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        const comparison = aDate - bDate;
        return direction === "asc" ? comparison : -comparison;
      },
      cell: (row) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Calendar className="size-4 shrink-0 text-text-secondary" />
          <span className="text-sm">{formatDate(row.dueDate)}</span>
        </div>
      ),
    },
    {
      id: "createdAt",
      header: "Created",
      accessorKey: "createdAt",
      sortable: true,
      sortFn: (a, b, direction) => {
        const aDate = new Date(a.createdAt).getTime();
        const bDate = new Date(b.createdAt).getTime();
        const comparison = aDate - bDate;
        return direction === "asc" ? comparison : -comparison;
      },
      cell: (row) => (
        <span className="whitespace-nowrap text-sm text-text-secondary">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ], [clientCompanies, users]);

  // ============================================
  // Handlers
  // ============================================

  const handleEditTask = useCallback((task: TaskData) => {
    setSelectedTask(task);
    setFormData({
      name: task.name,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
      clientCompanyId: task.clientCompanyId,
      assigneeId: task.assigneeId || "",
      blockedByTaskIds: task.blockedByTasks?.map((t) => t.id) || [],
      blockedByActionItemIds: task.blockedByActionItems?.map((a) => a.id) || [],
    });
    setNewAttachments([]);
    setAttachmentsToDelete([]);
    setUploadError(null);
    setIsEditModalOpen(true);
  }, []);

  // Open task modal when highlight param is present
  useEffect(() => {
    if (highlightIds.length > 0) {
      const highlightKey = highlightIds.join(",");
      
      // Only open the modal once per unique highlight
      if (handledHighlightRef.current !== highlightKey) {
        handledHighlightRef.current = highlightKey;
        
        // Find the highlighted task and open it in the modal
        const highlightedTask = tasks.find((t) => highlightIds.includes(t.id));
        if (highlightedTask) {
          handleEditTask(highlightedTask);
        }
      }
    } else {
      // Reset when highlight is cleared
      handledHighlightRef.current = null;
    }
  }, [highlightIds, tasks, handleEditTask]);

  const handleClearHighlight = useCallback(() => {
    router.replace("/dashboard/tasks", { scroll: false });
  }, [router]);

  const handleCreateTask = () => {
    setFormData({
      name: "",
      description: "",
      priority: "MEDIUM",
      status: "TODO",
      dueDate: "",
      clientCompanyId: purchasedClientCompanies[0]?.id || "",
      assigneeId: "",
      blockedByTaskIds: [],
      blockedByActionItemIds: [],
    });
    setNewAttachments([]);
    setUploadError(null);
    setIsCreateModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (250MB)
    if (file.size > 250 * 1024 * 1024) {
      setUploadError("File too large. Maximum size is 250MB.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      formDataUpload.append("context", "task");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const result = await response.json();
      setNewAttachments((prev) => [...prev, {
        name: result.name,
        url: result.url,
        type: result.type,
        size: result.size,
      }]);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveNewAttachment = (index: number) => {
    setNewAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMarkAttachmentForDeletion = (attachmentId: string) => {
    setAttachmentsToDelete((prev) => [...prev, attachmentId]);
  };

  const handleDeleteTask = (task: TaskData) => {
    setSelectedTask(task);
    setIsDeleteDialogOpen(true);
  };

  // Agent execution handlers
  const fetchRepos = async () => {
    if (repos.length > 0) return; // Already fetched
    setLoadingRepos(true);
    try {
      const response = await fetch("/api/github/repos");
      const result = await response.json();
      if (result.data) {
        setRepos(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch repos:", error);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleOpenAgentModal = () => {
    setSelectedRepo("");
    setAdditionalPrompt("");
    setRepoSearchQuery("");
    fetchRepos();
    setIsAgentModalOpen(true);
  };

  const handleExecuteWithAgent = async () => {
    if (!selectedTask || !selectedRepo) return;

    setIsExecutingAgent(true);
    try {
      const result = await executeTaskWithAgent(
        selectedTask.id,
        selectedRepo,
        additionalPrompt || undefined
      );

      if (result.error) {
        alert(result.error);
      } else if (result.data) {
        // Update the task in the local state with the new execution
        setTasks((prev) =>
          prev.map((t) =>
            t.id === selectedTask.id
              ? {
                ...t,
                status: "IN_PROGRESS",
                agentExecutions: [result.data!, ...(t.agentExecutions || [])],
              }
              : t
          )
        );
        // Update selectedTask as well
        setSelectedTask((prev) =>
          prev
            ? {
              ...prev,
              status: "IN_PROGRESS",
              agentExecutions: [result.data!, ...(prev.agentExecutions || [])],
            }
            : null
        );
        setIsAgentModalOpen(false);
      }
    } catch (error) {
      console.error("Failed to execute with agent:", error);
      alert("Failed to execute with agent");
    } finally {
      setIsExecutingAgent(false);
    }
  };

  const handleSyncAgentExecution = async (executionId: string) => {
    try {
      const result = await syncTaskAgentExecutionStatus(executionId);
      if (result.data && selectedTask) {
        // Update the execution in local state
        setTasks((prev) =>
          prev.map((t) =>
            t.id === selectedTask.id
              ? {
                ...t,
                agentExecutions: t.agentExecutions?.map((e) =>
                  e.id === executionId ? result.data! : e
                ),
              }
              : t
          )
        );
        setSelectedTask((prev) =>
          prev
            ? {
              ...prev,
              agentExecutions: prev.agentExecutions?.map((e) =>
                e.id === executionId ? result.data! : e
              ),
            }
            : null
        );
      }
    } catch (error) {
      console.error("Failed to sync agent execution:", error);
    }
  };

  // Check if task has active agent execution
  const hasActiveAgent = useMemo(() => {
    return selectedTask?.agentExecutions?.some(
      (exec) => exec.cursorAgentStatus === "CREATING" || exec.cursorAgentStatus === "RUNNING"
    ) ?? false;
  }, [selectedTask?.agentExecutions]);

  // Get filtered repos
  const filteredRepos = useMemo(() => {
    if (!repoSearchQuery) return repos;
    const query = repoSearchQuery.toLowerCase();
    return repos.filter(
      (repo) =>
        repo.name.toLowerCase().includes(query) ||
        repo.description?.toLowerCase().includes(query)
    );
  }, [repos, repoSearchQuery]);

  // A task is only really "Blocked" when it has at least one blocker that isn't Done yet.
  // Respect an explicit "Done" choice, and downgrade a stale "Blocked" to "Todo" once all
  // blockers are resolved so tasks can't get stuck in the Blocked column.
  const resolveStatusWithBlockers = (
    desiredStatus: TaskStatus,
    blockedByTaskIds: string[],
    blockedByActionItemIds: string[]
  ): TaskStatus => {
    if (desiredStatus === "DONE") return "DONE";

    const hasActiveBlockers =
      blockedByTaskIds.some(
        (id) => tasks.find((t) => t.id === id)?.status !== "DONE"
      ) ||
      blockedByActionItemIds.some(
        (id) => actionItems.find((a) => a.id === id)?.status !== "DONE"
      );

    if (hasActiveBlockers) return "BLOCKED";
    if (desiredStatus === "BLOCKED") return "TODO";
    return desiredStatus;
  };

  const handleSubmitCreate = async () => {
    if (!formData.name || !formData.clientCompanyId) return;

    const effectiveStatus = resolveStatusWithBlockers(
      formData.status,
      formData.blockedByTaskIds,
      formData.blockedByActionItemIds
    );

    // Create optimistic task with real cuid
    const taskId = createId();
    const clientCompany = purchasedClientCompanies.find((c) => c.id === formData.clientCompanyId);
    const assignee = formData.assigneeId ? users.find((u) => u.id === formData.assigneeId) : null;

    // Get blocker data for optimistic update
    const blockedByTasksData = formData.blockedByTaskIds
      .map((id) => tasks.find((t) => t.id === id))
      .filter((t): t is TaskData => t !== undefined)
      .map((t) => ({ id: t.id, name: t.name, status: t.status }));
    const blockedByActionItemsData = formData.blockedByActionItemIds
      .map((id) => actionItems.find((a) => a.id === id))
      .filter((a): a is ActionItemData => a !== undefined)
      .map((a) => ({ id: a.id, name: a.name, status: a.status }));

    // Create optimistic attachments with cuid IDs
    const optimisticAttachments = newAttachments.map((att) => ({
      id: createId(),
      name: att.name,
      url: att.url,
      type: att.type,
      size: att.size,
    }));

    const optimisticTask: TaskData = {
      id: taskId,
      name: formData.name,
      description: formData.description || null,
      priority: formData.priority,
      status: effectiveStatus,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
      clientCompanyId: formData.clientCompanyId,
      clientCompany: {
        id: clientCompany?.id || "",
        name: clientCompany?.name || "",
      },
      assigneeId: formData.assigneeId || null,
      assignee: assignee ? { id: assignee.id, email: assignee.email } : null,
      blockedByTasks: blockedByTasksData,
      blockedByActionItems: blockedByActionItemsData,
      attachments: optimisticAttachments,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Optimistically add to list and close modal
    setTasks((prev) => [optimisticTask, ...prev]);
    setIsCreateModalOpen(false);

    try {
      const result = await createTask({
        id: taskId,
        name: formData.name,
        description: formData.description || undefined,
        priority: formData.priority,
        status: effectiveStatus,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        clientCompanyId: formData.clientCompanyId,
        assigneeId: formData.assigneeId || undefined,
        blockedByTaskIds: formData.blockedByTaskIds,
        blockedByActionItemIds: formData.blockedByActionItemIds,
        attachments: newAttachments.length > 0 ? newAttachments : undefined,
      });

      if (result.error) {
        // Revert optimistic update
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        alert(result.error);
      } else if (result.data) {
        // Update with real data including attachments
        setTasks((prev) => prev.map((t) => (t.id === taskId ? result.data : t)));
      }
      setNewAttachments([]);
    } catch {
      // Revert on error
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      alert("Failed to create task");
    }
  };

  const handleSubmitEdit = async () => {
    if (!selectedTask || !formData.name || !formData.clientCompanyId) return;

    const effectiveStatus = resolveStatusWithBlockers(
      formData.status,
      formData.blockedByTaskIds,
      formData.blockedByActionItemIds
    );

    const clientCompany = purchasedClientCompanies.find((c) => c.id === formData.clientCompanyId);
    const assignee = formData.assigneeId ? users.find((u) => u.id === formData.assigneeId) : null;

    // Get blocker data for optimistic update
    const blockedByTasksData = formData.blockedByTaskIds
      .map((id) => tasks.find((t) => t.id === id))
      .filter((t): t is TaskData => t !== undefined)
      .map((t) => ({ id: t.id, name: t.name, status: t.status }));
    const blockedByActionItemsData = formData.blockedByActionItemIds
      .map((id) => actionItems.find((a) => a.id === id))
      .filter((a): a is ActionItemData => a !== undefined)
      .map((a) => ({ id: a.id, name: a.name, status: a.status }));

    // Store previous state for rollback
    const previousTasks = [...tasks];

    // Create optimistic attachments with cuid IDs for new attachments
    const optimisticNewAttachments = newAttachments.map((att) => ({
      id: createId(),
      name: att.name,
      url: att.url,
      type: att.type,
      size: att.size,
    }));

    // Combine existing attachments (excluding deleted ones) with new ones
    const remainingAttachments = (selectedTask.attachments || []).filter(
      (a) => !attachmentsToDelete.includes(a.id)
    );
    const combinedAttachments = [
      ...remainingAttachments,
      ...optimisticNewAttachments,
    ];

    // Create optimistic update
    const optimisticTask: TaskData = {
      ...selectedTask,
      name: formData.name,
      description: formData.description || null,
      priority: formData.priority,
      status: effectiveStatus,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
      clientCompanyId: formData.clientCompanyId,
      clientCompany: {
        id: clientCompany?.id || "",
        name: clientCompany?.name || "",
      },
      assigneeId: formData.assigneeId || null,
      assignee: assignee ? { id: assignee.id, email: assignee.email } : null,
      blockedByTasks: blockedByTasksData,
      blockedByActionItems: blockedByActionItemsData,
      attachments: combinedAttachments,
      updatedAt: new Date(),
    };

    // Store attachments to delete for after save
    const attachmentsToDeleteNow = [...attachmentsToDelete];

    // Optimistically update and close modal
    setTasks((prev) => prev.map((t) => (t.id === selectedTask.id ? optimisticTask : t)));
    setIsEditModalOpen(false);
    setSelectedTask(null);

    try {
      // Delete marked attachments
      for (const attachmentId of attachmentsToDeleteNow) {
        await deleteAttachment(attachmentId);
      }

      const result = await updateTask(selectedTask.id, {
        name: formData.name,
        description: formData.description || undefined,
        priority: formData.priority,
        status: effectiveStatus,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
        clientCompanyId: formData.clientCompanyId,
        assigneeId: formData.assigneeId || null,
        blockedByTaskIds: formData.blockedByTaskIds,
        blockedByActionItemIds: formData.blockedByActionItemIds,
        newAttachments: newAttachments.length > 0 ? newAttachments : undefined,
      });
      setNewAttachments([]);
      setAttachmentsToDelete([]);

      if (result.error) {
        // Revert optimistic update
        setTasks(previousTasks);
        alert(result.error);
      } else if (result.data) {
        // Update with real data from server
        setTasks((prev) =>
          prev.map((t) => (t.id === selectedTask.id ? result.data : t))
        );
      }
    } catch {
      // Revert on error
      setTasks(previousTasks);
      alert("Failed to update task");
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedTask) return;

    // Store previous state for rollback
    const previousTasks = [...tasks];

    // Optimistically remove and close dialog
    setTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));
    setIsDeleteDialogOpen(false);
    const taskToDelete = selectedTask;
    setSelectedTask(null);

    try {
      const result = await deleteTask(taskToDelete.id);
      if (result.error) {
        // Revert optimistic update
        setTasks(previousTasks);
        alert(result.error);
      }
    } catch {
      // Revert on error
      setTasks(previousTasks);
      alert("Failed to delete task");
    }
  };

  // ============================================
  // View Management
  // ============================================

  // Convert TaskViewData to ViewData format for DataTable
  const convertedViews: ViewData[] = useMemo(() => {
    return savedViews.map((view) => ({
      id: view.id,
      name: view.name,
      viewMode: view.viewMode as "table" | "board",
      sortColumn: view.sortColumn,
      sortDirection: view.sortDirection as "asc" | "desc",
      filters: {
        status: view.statusFilters,
        priority: view.priorityFilters,
        client: view.clientFilters,
        assignee: view.assigneeFilters,
        createdBy: view.createdByFilters || [],
        agentExecution: view.agentExecutionFilters || [],
      },
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
    }));
  }, [savedViews]);

  const handleSaveView = async (view: Omit<ViewData, "id" | "createdAt" | "updatedAt">) => {
    const result = await createTaskView({
      name: view.name,
      viewMode: view.viewMode,
      sortColumn: view.sortColumn,
      sortDirection: view.sortDirection,
      statusFilters: (view.filters.status as string[]) || [],
      priorityFilters: (view.filters.priority as string[]) || [],
      clientFilters: (view.filters.client as string[]) || [],
      assigneeFilters: (view.filters.assignee as string[]) || [],
      createdByFilters: (view.filters.createdBy as string[]) || [],
      agentExecutionFilters: (view.filters.agentExecution as string[]) || [],
    });

    if (result.error) {
      throw new Error(result.error);
    }

    if (result.data) {
      setSavedViews((prev) => [...prev, result.data!].sort((a, b) => a.name.localeCompare(b.name)));
    }
  };

  const handleUpdateView = async (id: string, data: Partial<ViewData>) => {
    const result = await updateTaskView(id, { name: data.name });
    if (result.data) {
      setSavedViews((prev) =>
        prev
          .map((v) => (v.id === id ? { ...v, name: data.name || v.name } : v))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    }
  };

  const handleDeleteView = async (id: string) => {
    const result = await deleteTaskView(id);
    if (result.data) {
      setSavedViews((prev) => prev.filter((v) => v.id !== id));
    }
  };

  // ============================================
  // Render Actions
  // ============================================

  const renderActions = useCallback((task: TaskData) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            handleEditTask(task);
          }}
        >
          <Pencil className="mr-2 size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-red-600"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteTask(task);
          }}
        >
          <Trash2 className="mr-2 size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ), [handleEditTask]);

  // ============================================
  // Board View Card Renderer
  // ============================================

  const renderBoardCard = useCallback((task: TaskData) => {
    const PriorityIcon = priorityConfig[task.priority].icon;
    return (
      <>
        <div className="mb-2 flex items-start justify-between">
          <p className="text-text-dark font-medium">{task.name}</p>
          <Badge className={`${priorityConfig[task.priority].color} border text-xs`}>
            <PriorityIcon className="mr-1 size-3" />
            {priorityConfig[task.priority].label}
          </Badge>
        </div>
        {task.description && (
          <p className="mb-2 line-clamp-2 text-sm text-text-secondary">
            {task.description}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <div className="flex items-center gap-1">
            <Building2 className="size-3" />
            {task.clientCompany.name}
          </div>
          {task.dueDate && (
            <div className="flex items-center gap-1">
              <Calendar className="size-3" />
              {formatDate(task.dueDate)}
            </div>
          )}
        </div>
        {task.assignee && (
          <div className="mt-2 flex items-center gap-1 text-xs text-text-secondary">
            <User className="size-3" />
            {task.assignee.email}
          </div>
        )}
      </>
    );
  }, []);

  // ============================================
  // Custom Search Function
  // ============================================

  const searchFn = useCallback((task: TaskData, query: string) => {
    const q = query.toLowerCase();
    return (
      task.name.toLowerCase().includes(q) ||
      task.clientCompany.name.toLowerCase().includes(q) ||
      (task.assignee?.email.toLowerCase().includes(q) ?? false)
    );
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-text-dark text-2xl font-bold">Tasks</h1>
          <p className="text-text-secondary">Manage project tasks and assignments</p>
        </div>
        <Button onClick={handleCreateTask}>
          <Plus className="mr-2 size-4" />
          New Task
        </Button>
      </div>

      {/* Data Table */}
      <DataTable
        data={tasks}
        columns={columns}
        storageKey="admin-tasks"
        searchable
        searchPlaceholder="Search tasks..."
        searchFn={searchFn}
        enableBoardView
        boardGroupBy="status"
        boardGroupConfig={{
          TODO: { label: "Todo", icon: Circle },
          IN_PROGRESS: { label: "In Progress", icon: Clock },
          BLOCKED: { label: "Blocked", icon: Ban },
          DONE: { label: "Done", icon: CheckCircle2 },
        }}
        boardGroupOrder={["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]}
        renderBoardCard={renderBoardCard}
        savedViews={convertedViews}
        onSaveView={handleSaveView}
        onUpdateView={handleUpdateView}
        onDeleteView={handleDeleteView}
        getRowId={(task) => task.id}
        onRowClick={handleEditTask}
        highlightIds={highlightIds}
        onHighlightClear={handleClearHighlight}
        renderActions={renderActions}
        pageSize={25}
        emptyMessage="No tasks yet. Create your first task."
        emptyFilteredMessage="No tasks found matching your search or filters."
        defaultSort={{ column: "createdAt", direction: "desc" }}
        urlFilters={urlFilters}
      />

      {/* Create/Edit Task Modal */}
      <Dialog
        open={isCreateModalOpen || isEditModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateModalOpen(false);
            setIsEditModalOpen(false);
          }
        }}
      >
        <DialogContent className="flex min-h-[624px] max-w-2xl flex-col p-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-text-secondary" />
              <span className="text-sm text-text-secondary">
                {purchasedClientCompanies.find((c) => c.id === formData.clientCompanyId)?.name || "Select client"}
              </span>
              <span className="text-text-secondary">&rsaquo;</span>
              <span className="text-sm font-medium">
                {isCreateModalOpen ? "New task" : "Edit task"}
              </span>
            </div>
            {/* Show creator info and meeting link for existing tasks */}
            {isEditModalOpen && selectedTask && (
              <div className="flex items-center gap-3">
                {selectedTask.createdByJaroDevAutomation && (
                  <span className="flex items-center gap-1.5 text-xs text-primary-600">
                    <Bot className="size-3.5" />
                    Created by Automation
                  </span>
                )}
                {selectedTask.meeting && (
                  <Link
                    href={`/dashboard/clients/${selectedTask.meeting.clientCompanyId}?meeting=${selectedTask.meeting.id}`}
                    className="flex items-center gap-1.5 text-xs text-secondary-600 hover:text-primary-600"
                    onClick={() => {
                      setIsEditModalOpen(false);
                    }}
                  >
                    <Video className="size-3.5" />
                    From: {selectedTask.meeting.title}
                    <ExternalLink className="size-3" />
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Title & Description */}
          <div className="flex flex-1 flex-col px-4">
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Task title"
              className="border-0 px-0 text-xl font-medium shadow-none focus-visible:ring-0"
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
            {hasActiveAgent ? (
              <div className="flex h-8 items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3">
                <Bot className="size-4 text-primary-600" />
                <span className="text-sm text-primary-700">Jaro.dev Agent</span>
              </div>
            ) : (
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
            )}

            {/* Client Company - only show PURCHASED clients in create/edit */}
            <Select
              value={formData.clientCompanyId}
              onValueChange={(value) => setFormData({ ...formData, clientCompanyId: value })}
            >
              <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3">
                <Building2 className="size-4 text-text-secondary" />
                <span className="text-sm">
                  {formData.clientCompanyId
                    ? purchasedClientCompanies.find((c) => c.id === formData.clientCompanyId)?.name || "Client"
                    : "Client"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {purchasedClientCompanies.map((company) => (
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

            {/* Blocked By */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-2 rounded-full"
              onClick={() => setIsBlockerModalOpen(true)}
            >
              <Ban className="size-4 text-text-secondary" />
              <span className="text-sm">
                {formData.blockedByTaskIds.length + formData.blockedByActionItemIds.length > 0
                  ? `Blocked by ${formData.blockedByTaskIds.length + formData.blockedByActionItemIds.length}`
                  : "Add blocker"}
              </span>
            </Button>

            {/* Attachments */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              accept="image/png,image/jpeg,video/mp4"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-2 rounded-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin text-text-secondary" />
              ) : (
                <Paperclip className="size-4 text-text-secondary" />
              )}
              <span className="text-sm">
                {isUploading ? "Uploading..." : "Attach file"}
              </span>
            </Button>
          </div>

          {/* Attachments Section */}
          {((isEditModalOpen && selectedTask?.attachments && selectedTask.attachments.filter(a => !attachmentsToDelete.includes(a.id)).length > 0) || newAttachments.length > 0) && (
            <div className="space-y-2 px-4 pb-2">
              <p className="text-sm font-medium text-text-secondary">Attachments</p>
              <div className="flex flex-wrap gap-3">
                {/* Existing attachments (only in edit mode, excluding ones marked for deletion) */}
                {isEditModalOpen && selectedTask?.attachments?.filter(a => !attachmentsToDelete.includes(a.id)).map((attachment) => {
                  const isVideo = attachment.type.startsWith("video/");
                  const isImage = attachment.type.startsWith("image/");
                  return (
                    <div
                      key={attachment.id}
                      className="group relative"
                    >
                      <div
                        onClick={() => setPreviewAttachment({
                          url: attachment.url,
                          type: attachment.type,
                          name: attachment.name,
                        })}
                        className="relative size-20 cursor-pointer overflow-hidden rounded-lg border border-border bg-background-secondary transition-all hover:border-primary-400 hover:shadow-md"
                      >
                        {isImage ? (
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="size-full object-cover"
                          />
                        ) : isVideo ? (
                          <div className="flex size-full items-center justify-center bg-secondary-100">
                            <Video className="size-8 text-secondary-500" />
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleMarkAttachmentForDeletion(attachment.id);
                        }}
                        className="absolute -right-2 -top-2 z-10 flex size-5 items-center justify-center rounded-full bg-danger-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  );
                })}
                {/* New attachments (pending upload) */}
                {newAttachments.map((attachment, index) => {
                  const isVideo = attachment.type.startsWith("video/");
                  const isImage = attachment.type.startsWith("image/");
                  return (
                    <div
                      key={`new-${index}`}
                      className="group relative"
                    >
                      <div
                        onClick={() => setPreviewAttachment({
                          url: attachment.url,
                          type: attachment.type,
                          name: attachment.name,
                        })}
                        className="relative size-20 cursor-pointer overflow-hidden rounded-lg border-2 border-success-400 bg-background-secondary transition-all hover:border-success-500 hover:shadow-md"
                      >
                        {isImage ? (
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="size-full object-cover"
                          />
                        ) : isVideo ? (
                          <div className="flex size-full items-center justify-center bg-success-50">
                            <Video className="size-8 text-success-500" />
                          </div>
                        ) : null}
                        <div className="absolute inset-x-0 bottom-0 bg-success-500 px-1 py-0.5 text-center text-[10px] text-white">
                          New
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveNewAttachment(index);
                        }}
                        className="absolute -right-2 -top-2 z-10 flex size-5 items-center justify-center rounded-full bg-danger-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload Error */}
          {uploadError && (
            <div className="mx-4 mb-2 text-sm text-danger-600">{uploadError}</div>
          )}

          {/* Agent Executions Section */}
          {isEditModalOpen && selectedTask?.agentExecutions && selectedTask.agentExecutions.length > 0 && (
            <div className="space-y-3 border-t border-border p-4">
              <div className="flex items-center justify-between">
                <p className="text-text-dark text-sm font-medium">Agent Executions</p>
                {hasActiveAgent && (
                  <Badge className="border border-primary-200 bg-primary-50 text-primary-700">
                    <Loader2 className="mr-1 size-3 animate-spin" />
                    Agent Active
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                {selectedTask.agentExecutions.map((execution) => (
                  <div
                    key={execution.id}
                    className="rounded-lg border border-border bg-background-secondary p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <GitBranch className="size-4 text-text-secondary" />
                          <span className="text-sm font-medium">{execution.githubRepoName}</span>
                          <AgentStatusBadge status={execution.cursorAgentStatus} />
                        </div>
                        <p className="text-xs text-text-secondary">
                          Started {new Date(execution.createdAt).toLocaleString()}
                        </p>
                        {execution.branchName && (
                          <p className="text-xs text-text-secondary">
                            Branch: {execution.branchName}
                          </p>
                        )}
                        {execution.summary && (
                          <p className="mt-2 text-sm text-text-secondary">
                            {execution.summary}
                          </p>
                        )}
                        {execution.errorMessage && (
                          <p className="mt-2 text-sm text-danger-600">
                            {execution.errorMessage}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {(execution.cursorAgentStatus === "CREATING" || execution.cursorAgentStatus === "RUNNING") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSyncAgentExecution(execution.id)}
                          >
                            <RefreshCw className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(execution.cursorAgentUrl, "_blank")}
                        >
                          <Bot className="mr-1 size-4" />
                          Agent
                          <ExternalLink className="ml-1 size-3" />
                        </Button>
                        {execution.prUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(execution.prUrl!, "_blank")}
                          >
                            <GitBranch className="mr-1 size-4" />
                            View PR
                            <ExternalLink className="ml-1 size-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BLOCKED status warning */}
          {formData.status === "BLOCKED" && formData.blockedByTaskIds.length === 0 && formData.blockedByActionItemIds.length === 0 && (
            <div className="mx-4 mb-4 flex items-center gap-2 rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
              <Ban className="size-4" />
              <span>Please select at least one blocker when status is set to Blocked.</span>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            {/* Execute with Agent button (only in edit mode) */}
            <div>
              {isEditModalOpen && !hasActiveAgent && (
                <Button
                  variant="outline"
                  onClick={handleOpenAgentModal}
                >
                  <Bot className="mr-2 size-4" />
                  Execute with Agent
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={isCreateModalOpen ? handleSubmitCreate : handleSubmitEdit}
                disabled={
                  !formData.name || 
                  !formData.clientCompanyId || 
                  isUploading ||
                  (formData.status === "BLOCKED" && formData.blockedByTaskIds.length === 0 && formData.blockedByActionItemIds.length === 0)
                }
              >
                {isCreateModalOpen ? "Create task" : "Save changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedTask?.name}&quot;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleConfirmDelete} variant="destructive">
              Delete
            </Button>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocker Selection Modal */}
      <Dialog open={isBlockerModalOpen} onOpenChange={(open) => {
        setIsBlockerModalOpen(open);
        if (!open) setBlockerSearchQuery("");
      }}>
        <DialogContent className="flex max-h-[80vh] max-w-lg flex-col">
          <DialogHeader>
            <DialogTitle>Select Blockers</DialogTitle>
            <DialogDescription>
              Select tasks or action items that block this task from being completed.
            </DialogDescription>
          </DialogHeader>
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
            <Input
              placeholder="Search tasks and action items..."
              value={blockerSearchQuery}
              onChange={(e) => setBlockerSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            {/* Action Items Section */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-text-secondary">Action Items</h4>
              <div className="space-y-1">
                {actionItems
                  .filter((a) =>
                    a.name.toLowerCase().includes(blockerSearchQuery.toLowerCase()) &&
                      // Hide done action items, but keep already-selected ones visible so a
                      // resolved blocker can still be removed from the task.
                      (a.status !== "DONE" || formData.blockedByActionItemIds.includes(a.id))
                  )
                  .sort((a, b) => {
                    const aSelected = formData.blockedByActionItemIds.includes(a.id);
                    const bSelected = formData.blockedByActionItemIds.includes(b.id);
                    if (aSelected && !bSelected) return -1;
                    if (!aSelected && bSelected) return 1;
                    return 0;
                  })
                  .slice(0, 10)
                  .map((actionItem) => {
                    const isSelected = formData.blockedByActionItemIds.includes(actionItem.id);
                    const StatusIcon = statusConfig[actionItem.status].icon;
                    return (
                      <div
                        key={actionItem.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors ${
                            isSelected
                              ? "border border-primary-200 bg-primary-50"
                              : "hover:bg-secondary-50"
                          }`}
                        onClick={() => {
                          if (isSelected) {
                            const nextActionItemIds = formData.blockedByActionItemIds.filter(
                              (id) => id !== actionItem.id
                            );
                            const hasRemainingBlockers =
                              nextActionItemIds.length > 0 ||
                              formData.blockedByTaskIds.length > 0;
                            setFormData({
                              ...formData,
                              blockedByActionItemIds: nextActionItemIds,
                              // Drop the task out of Blocked once its last blocker is removed.
                              status:
                                !hasRemainingBlockers && formData.status === "BLOCKED"
                                  ? "TODO"
                                  : formData.status,
                            });
                          } else {
                            setFormData({
                              ...formData,
                              blockedByActionItemIds: [
                                ...formData.blockedByActionItemIds,
                                actionItem.id,
                              ],
                            });
                          }
                        }}
                      >
                        <StatusIcon className="size-4 text-text-secondary" />
                        <div className="flex-1 truncate">
                          <p className="truncate text-sm font-medium">{actionItem.name}</p>
                          <p className="text-xs text-text-secondary">
                            {actionItem.clientCompany.name}
                          </p>
                        </div>
                        {isSelected && <CheckCircle2 className="size-4 text-primary-600" />}
                      </div>
                    );
                  })}
                {actionItems.filter((a) =>
                  a.name.toLowerCase().includes(blockerSearchQuery.toLowerCase()) &&
                    (a.status !== "DONE" || formData.blockedByActionItemIds.includes(a.id))
                ).length === 0 && (
                  <p className="py-2 text-center text-sm text-text-secondary">
                      No action items found
                  </p>
                )}
              </div>
            </div>

            {/* Tasks Section */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-text-secondary">Tasks</h4>
              <div className="space-y-1">
                {tasks
                  .filter((t) =>
                    t.name.toLowerCase().includes(blockerSearchQuery.toLowerCase()) &&
                      t.id !== selectedTask?.id && // Don't show current task
                      // Hide done tasks, but keep already-selected ones visible so a
                      // resolved blocker can still be removed from the task.
                      (t.status !== "DONE" || formData.blockedByTaskIds.includes(t.id))
                  )
                  .sort((a, b) => {
                    const aSelected = formData.blockedByTaskIds.includes(a.id);
                    const bSelected = formData.blockedByTaskIds.includes(b.id);
                    if (aSelected && !bSelected) return -1;
                    if (!aSelected && bSelected) return 1;
                    return 0;
                  })
                  .slice(0, 10)
                  .map((task) => {
                    const isSelected = formData.blockedByTaskIds.includes(task.id);
                    const StatusIcon = statusConfig[task.status].icon;
                    return (
                      <div
                        key={task.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors ${
                            isSelected
                              ? "border border-primary-200 bg-primary-50"
                              : "hover:bg-secondary-50"
                          }`}
                        onClick={() => {
                          if (isSelected) {
                            const nextTaskIds = formData.blockedByTaskIds.filter(
                              (id) => id !== task.id
                            );
                            const hasRemainingBlockers =
                              nextTaskIds.length > 0 ||
                              formData.blockedByActionItemIds.length > 0;
                            setFormData({
                              ...formData,
                              blockedByTaskIds: nextTaskIds,
                              // Drop the task out of Blocked once its last blocker is removed.
                              status:
                                !hasRemainingBlockers && formData.status === "BLOCKED"
                                  ? "TODO"
                                  : formData.status,
                            });
                          } else {
                            setFormData({
                              ...formData,
                              blockedByTaskIds: [...formData.blockedByTaskIds, task.id],
                            });
                          }
                        }}
                      >
                        <StatusIcon className="size-4 text-text-secondary" />
                        <div className="flex-1 truncate">
                          <p className="truncate text-sm font-medium">{task.name}</p>
                          <p className="text-xs text-text-secondary">
                            {task.clientCompany.name}
                          </p>
                        </div>
                        {isSelected && <CheckCircle2 className="size-4 text-primary-600" />}
                      </div>
                    );
                  })}
                {tasks.filter(
                  (t) =>
                    t.name.toLowerCase().includes(blockerSearchQuery.toLowerCase()) &&
                      t.id !== selectedTask?.id &&
                      (t.status !== "DONE" || formData.blockedByTaskIds.includes(t.id))
                ).length === 0 && (
                  <p className="py-2 text-center text-sm text-text-secondary">
                      No tasks found
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button
              onClick={() => {
                setIsBlockerModalOpen(false);
                setBlockerSearchQuery("");
              }}
            >
              Done
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsBlockerModalOpen(false);
                setBlockerSearchQuery("");
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agent Selection Modal */}
      <Dialog open={isAgentModalOpen} onOpenChange={setIsAgentModalOpen}>
        <DialogContent className="flex max-h-[80vh] max-w-lg flex-col">
          <DialogHeader>
            <DialogTitle>Execute with Agent</DialogTitle>
            <DialogDescription>
              Select a repository and optionally add extra instructions for the agent.
            </DialogDescription>
          </DialogHeader>

          {/* Task info */}
          {selectedTask && (
            <div className="rounded-lg border border-border bg-background-secondary p-3">
              <p className="text-sm font-medium">{selectedTask.name}</p>
              {selectedTask.description && (
                <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
                  {selectedTask.description}
                </p>
              )}
            </div>
          )}

          {/* Repo search */}
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
            <Input
              placeholder="Search repositories..."
              value={repoSearchQuery}
              onChange={(e) => setRepoSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Repo list */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingRepos ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-text-secondary" />
              </div>
            ) : filteredRepos.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-secondary">
                No repositories found
              </p>
            ) : (
              <div className="space-y-1">
                {filteredRepos.map((repo) => {
                  const isSelected = selectedRepo === repo.name;
                  return (
                    <div
                      key={repo.name}
                      className={`flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors ${
                        isSelected
                          ? "border border-primary-200 bg-primary-50"
                          : "hover:bg-secondary-50"
                      }`}
                      onClick={() => setSelectedRepo(repo.name)}
                    >
                      <GitBranch className="size-4 shrink-0 text-text-secondary" />
                      <div className="flex-1 truncate">
                        <p className="truncate text-sm font-medium">{repo.name}</p>
                        {repo.description && (
                          <p className="truncate text-xs text-text-secondary">
                            {repo.description}
                          </p>
                        )}
                      </div>
                      {isSelected && <CheckCircle2 className="size-4 shrink-0 text-primary-600" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Additional prompt */}
          <div className="shrink-0 space-y-2">
            <label className="text-text-dark text-sm font-medium">
              Additional Instructions (optional)
            </label>
            <Textarea
              placeholder="Add any extra context or requirements for the agent..."
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter className="shrink-0">
            <Button
              onClick={handleExecuteWithAgent}
              disabled={!selectedRepo || isExecutingAgent}
            >
              {isExecutingAgent ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Launching Agent...
                </>
              ) : (
                <>
                  <Play className="mr-2 size-4" />
                  Execute
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsAgentModalOpen(false)}
              disabled={isExecutingAgent}
            >
              Cancel
            </Button>
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
              {/* Close button */}
              <button
                onClick={() => setPreviewAttachment(null)}
                className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
              >
                <X className="size-4" />
              </button>
              
              {/* Image preview */}
              {previewAttachment.type.startsWith("image/") && (
                <div className="flex max-h-[85vh] items-center justify-center bg-black p-4">
                  <img
                    src={previewAttachment.url}
                    alt={previewAttachment.name}
                    className="max-h-[80vh] max-w-full object-contain"
                  />
                </div>
              )}
              
              {/* Video preview */}
              {previewAttachment.type.startsWith("video/") && (
                <div className="flex max-h-[85vh] items-center justify-center bg-black p-4">
                  <video
                    src={previewAttachment.url}
                    controls
                    autoPlay
                    className="max-h-[80vh] max-w-full"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
              
              {/* File name */}
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

// ============================================
// Utilities
// ============================================

function formatDate(date: Date | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ============================================
// Agent Status Badge Component
// ============================================

function AgentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon?: React.ReactNode }> = {
    CREATING: {
      label: "Creating",
      className: "bg-secondary-100 text-secondary-700 border-secondary-200",
      icon: <Loader2 className="mr-1 size-3 animate-spin" />,
    },
    RUNNING: {
      label: "Running",
      className: "bg-primary-100 text-primary-700 border-primary-200",
      icon: <Loader2 className="mr-1 size-3 animate-spin" />,
    },
    FINISHED: {
      label: "Finished",
      className: "bg-success-100 text-success-700 border-success-200",
      icon: <CheckCircle2 className="mr-1 size-3" />,
    },
    ERROR: {
      label: "Error",
      className: "bg-danger-100 text-danger-700 border-danger-200",
      icon: <AlertCircle className="mr-1 size-3" />,
    },
    STOPPED: {
      label: "Stopped",
      className: "bg-warning-100 text-warning-700 border-warning-200",
      icon: <Ban className="mr-1 size-3" />,
    },
  };

  const statusConfig = config[status] || {
    label: status,
    className: "bg-secondary-100 text-secondary-700 border-secondary-200",
  };

  return (
    <Badge className={`${statusConfig.className} border text-xs`}>
      {statusConfig.icon}
      {statusConfig.label}
    </Badge>
  );
}
