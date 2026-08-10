"use client";

import { useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  Circle,
  Ban,
  Link2,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { TaskStatus as ActionItemStatus } from "@prisma/client";
import { createTaskView, updateTaskView, deleteTaskView, TaskViewData } from "@/lib/actions";
import { DataTable, ColumnDef, ViewData } from "@/components/data-table";

// ============================================
// Types
// ============================================

interface ActionItemData {
  id: string;
  name: string;
  status: ActionItemStatus;
}

interface TaskData {
  id: string;
  name: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  clientCompany: {
    id: string;
    name: string;
  };
  blockedByActionItems: ActionItemData[];
  createdAt: Date;
  updatedAt: Date;
}

interface ClientTasksClientProps {
  clientCompanyName: string;
  tasks: TaskData[];
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

export function ClientTasksClient({ clientCompanyName, tasks, savedViews: initialSavedViews }: ClientTasksClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse highlight query param
  const highlightParam = searchParams?.get("highlight");
  const highlightIds = useMemo(() => highlightParam ? highlightParam.split(",") : [], [highlightParam]);

  // Saved views state
  const [savedViews, setSavedViews] = useState<TaskViewData[]>(initialSavedViews);

  // ============================================
  // Column Definitions
  // ============================================

  const columns: ColumnDef<TaskData>[] = useMemo(() => [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      width: "w-2/5",
      sortable: true,
      cell: (row) => (
        <p className="text-text-dark truncate font-medium">{row.name}</p>
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
      id: "blockedBy",
      header: "Blocked By",
      accessorKey: "blockedByActionItems",
      sortable: false,
      cell: (row) => {
        if (row.blockedByActionItems.length === 0) {
          return <span className="text-sm text-text-secondary">-</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {row.blockedByActionItems.map((actionItem) => (
              <Link
                key={actionItem.id}
                href={`/dashboard/client-action-items?highlight=${actionItem.id}`}
                className="inline-flex items-center gap-1 rounded-md border border-warning-200 bg-warning-50 px-2 py-1 text-xs font-medium text-warning-700 transition-colors hover:bg-warning-100"
                onClick={(e) => e.stopPropagation()}
              >
                <Link2 className="size-3" />
                <span className="max-w-[150px] truncate">{actionItem.name}</span>
              </Link>
            ))}
          </div>
        );
      },
    },
  ], []);

  // ============================================
  // Handlers
  // ============================================

  const handleClearHighlight = useCallback(() => {
    router.replace("/dashboard/client-tasks", { scroll: false });
  }, [router]);

  // Convert saved views to DataTable format
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
      },
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
    }));
  }, [savedViews]);

  const handleSaveView = useCallback(async (view: Omit<ViewData, "id" | "createdAt" | "updatedAt">) => {
    const result = await createTaskView({
      name: view.name,
      viewMode: view.viewMode,
      sortColumn: view.sortColumn,
      sortDirection: view.sortDirection,
      statusFilters: (view.filters?.status as TaskStatus[]) || [],
      priorityFilters: (view.filters?.priority as TaskPriority[]) || [],
      clientFilters: [],
      assigneeFilters: [],
      createdByFilters: [],
      agentExecutionFilters: [],
    });

    if (result.error) {
      throw new Error(result.error);
    }

    if (result.data) {
      setSavedViews((prev) => [...prev, result.data!].sort((a, b) => a.name.localeCompare(b.name)));
    }
  }, []);

  const handleUpdateView = useCallback(async (id: string, data: Partial<ViewData>) => {
    const result = await updateTaskView(id, { name: data.name });

    if (result.error) {
      throw new Error(result.error);
    }

    if (result.data) {
      setSavedViews((prev) =>
        prev
          .map((v) => (v.id === id ? { ...v, name: data.name || v.name } : v))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    }
  }, []);

  const handleDeleteView = useCallback(async (id: string) => {
    const result = await deleteTaskView(id);

    if (result.error) {
      throw new Error(result.error);
    }

    setSavedViews((prev) => prev.filter((v) => v.id !== id));
  }, []);

  // ============================================
  // Board View Card Renderer
  // ============================================

  const renderBoardCard = useCallback((task: TaskData) => {
    const PriorityIcon = priorityConfig[task.priority].icon;
    return (
      <>
        <div className="mb-2 flex items-start justify-between">
          <p className="text-text-dark font-medium">{task.name}</p>
          <Badge className={`${priorityConfig[task.priority].color} whitespace-nowrap border text-xs`}>
            <PriorityIcon className="mr-1 size-3" />
            {priorityConfig[task.priority].label}
          </Badge>
        </div>
        {task.description && (
          <p className="line-clamp-2 text-sm text-text-secondary">
            {task.description}
          </p>
        )}
        {task.blockedByActionItems.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {task.blockedByActionItems.map((actionItem) => (
              <Link
                key={actionItem.id}
                href={`/dashboard/client-action-items?highlight=${actionItem.id}`}
                className="inline-flex items-center gap-1 rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700 transition-colors hover:bg-warning-100"
                onClick={(e) => e.stopPropagation()}
              >
                <Link2 className="size-3" />
                <span className="max-w-[100px] truncate">{actionItem.name}</span>
              </Link>
            ))}
          </div>
        )}
      </>
    );
  }, []);

  // ============================================
  // Custom Search Function
  // ============================================

  const searchFn = useCallback((task: TaskData, query: string) => {
    return task.name.toLowerCase().includes(query.toLowerCase());
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-secondary-900">Jaro.dev Tasks</h1>
        <p className="mt-1 text-sm text-secondary-500">
          Tasks being worked on by Jaro.dev for {clientCompanyName}
        </p>
      </div>

      {/* Data Table */}
      <DataTable
        data={tasks}
        columns={columns}
        storageKey="client-tasks"
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
        highlightIds={highlightIds}
        onHighlightClear={handleClearHighlight}
        pageSize={25}
        emptyMessage="No tasks yet."
        emptyFilteredMessage="No tasks found matching your search or filters."
      />
    </div>
  );
}
