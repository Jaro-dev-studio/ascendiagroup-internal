"use client";

import { useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  Circle,
  Ban,
  Eye,
} from "lucide-react";
import { updateActionItemStatus } from "@/lib/actions";
import { DataTable, ColumnDef } from "@/components/data-table";

// ============================================
// Types
// ============================================

interface ActionItemData {
  id: string;
  name: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  clientCompany: {
    id: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface ClientActionItemsClientProps {
  clientCompanyName: string;
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
  PENDING_ADMIN_REVIEW: { label: "Pending Review", color: "bg-warning-100 text-warning-700 border-warning-200", icon: Eye },
  TODO: { label: "Todo", color: "bg-secondary-100 text-secondary-600 border-secondary-200", icon: Circle },
  IN_PROGRESS: { label: "In Progress", color: "bg-primary-100 text-primary-700 border-primary-200", icon: Clock },
  BLOCKED: { label: "Blocked", color: "bg-danger-100 text-danger-700 border-danger-200", icon: Ban },
  DONE: { label: "Done", color: "bg-success-100 text-success-700 border-success-200", icon: CheckCircle2 },
};

// ============================================
// Main Component
// ============================================

export function ClientActionItemsClient({ clientCompanyName, actionItems: initialActionItems }: ClientActionItemsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [actionItems, setActionItems] = useState<ActionItemData[]>(initialActionItems);
  const [selectedItem, setSelectedItem] = useState<ActionItemData | null>(null);

  // Parse highlight query param
  const highlightParam = searchParams?.get("highlight");
  const highlightIds = useMemo(() => highlightParam ? highlightParam.split(",") : [], [highlightParam]);

  // ============================================
  // Handlers
  // ============================================

  const handleClearHighlight = useCallback(() => {
    router.replace("/dashboard/client-action-items", { scroll: false });
  }, [router]);

  const handleStatusChange = useCallback(async (itemId: string, newStatus: TaskStatus) => {
    const previousItems = [...actionItems];
    
    // Optimistic update
    setActionItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, status: newStatus } : item
      )
    );

    const result = await updateActionItemStatus(itemId, newStatus);
    if (result.error) {
      // Revert on error
      setActionItems(previousItems);
    }
  }, [actionItems]);

  // ============================================
  // Status Cell Component (with inline edit)
  // ============================================

  const StatusCell = useCallback(({ item }: { item: ActionItemData }) => {
    const StatusIcon = statusConfig[item.status].icon;
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <Select
          value={item.status}
          onValueChange={(value) => handleStatusChange(item.id, value as TaskStatus)}
        >
          <SelectTrigger className="size-auto gap-1.5 rounded-md border border-secondary-200 bg-white px-2 py-1 shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50 focus:ring-1 focus:ring-primary-500">
            <Badge className={`${statusConfig[item.status].color} whitespace-nowrap border`}>
              <StatusIcon className="mr-1 size-3" />
              {statusConfig[item.status].label}
            </Badge>
          </SelectTrigger>
          <SelectContent>
            {(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as TaskStatus[]).map((status) => {
              const Icon = statusConfig[status].icon;
              return (
                <SelectItem key={status} value={status}>
                  <div className="flex items-center gap-2">
                    <Icon className="size-3" />
                    {statusConfig[status].label}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    );
  }, [handleStatusChange]);

  // ============================================
  // Column Definitions
  // ============================================

  const columns: ColumnDef<ActionItemData>[] = useMemo(() => [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      width: "w-[50%]",
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
      cell: (row) => <StatusCell item={row} />,
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
  ], [StatusCell]);

  // ============================================
  // Board View Card Renderer (with inline status edit)
  // ============================================

  const renderBoardCard = useCallback((item: ActionItemData) => {
    const PriorityIcon = priorityConfig[item.priority].icon;
    return (
      <>
        <div className="mb-2 flex items-start justify-between">
          <p className="text-text-dark font-medium">{item.name}</p>
          <Badge className={`${priorityConfig[item.priority].color} whitespace-nowrap border text-xs`}>
            <PriorityIcon className="mr-1 size-3" />
            {priorityConfig[item.priority].label}
          </Badge>
        </div>
        {item.description && (
          <p className="line-clamp-2 text-sm text-text-secondary">
            {item.description}
          </p>
        )}
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <Select
            value={item.status}
            onValueChange={(value) => handleStatusChange(item.id, value as TaskStatus)}
          >
            <SelectTrigger className="h-7 w-full text-xs">
              <span className="flex items-center gap-1">
                {(() => {
                  const Icon = statusConfig[item.status].icon;
                  return <Icon className="size-3" />;
                })()}
                {statusConfig[item.status].label}
              </span>
            </SelectTrigger>
            <SelectContent>
              {(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as TaskStatus[]).map((s) => {
                const Icon = statusConfig[s].icon;
                return (
                  <SelectItem key={s} value={s}>
                    <div className="flex items-center gap-2">
                      <Icon className="size-3" />
                      {statusConfig[s].label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </>
    );
  }, [handleStatusChange]);

  // ============================================
  // Custom Search Function
  // ============================================

  const searchFn = useCallback((item: ActionItemData, query: string) => {
    return item.name.toLowerCase().includes(query.toLowerCase());
  }, []);

  // ============================================
  // Default filters (TODO and IN_PROGRESS)
  // ============================================

  const defaultFilters = useMemo(() => ({
    status: ["TODO", "IN_PROGRESS"] as string[],
  }), []);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-secondary-900">Action Items</h1>
        <p className="mt-1 text-sm text-secondary-500">
          Action items for {clientCompanyName} - click on the status to update as you complete them
        </p>
      </div>

      {/* Data Table */}
      <DataTable
        data={actionItems}
        columns={columns}
        storageKey="client-action-items"
        defaultFilters={defaultFilters}
        searchable
        searchPlaceholder="Search action items..."
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
        getRowId={(item) => item.id}
        onRowClick={setSelectedItem}
        highlightIds={highlightIds}
        onHighlightClear={handleClearHighlight}
        pageSize={25}
        emptyMessage="No action items yet."
        emptyFilteredMessage="No action items found matching your filters."
      />

      {/* Action Item Detail Modal */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {selectedItem?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Status and Priority badges */}
            <div className="flex flex-wrap items-center gap-2">
              {selectedItem && (
                <>
                  <Badge className={`${statusConfig[selectedItem.status].color} border`}>
                    {(() => {
                      const StatusIcon = statusConfig[selectedItem.status].icon;
                      return <StatusIcon className="mr-1 size-3" />;
                    })()}
                    {statusConfig[selectedItem.status].label}
                  </Badge>
                  <Badge className={`${priorityConfig[selectedItem.priority].color} border`}>
                    {(() => {
                      const PriorityIcon = priorityConfig[selectedItem.priority].icon;
                      return <PriorityIcon className="mr-1 size-3" />;
                    })()}
                    {priorityConfig[selectedItem.priority].label}
                  </Badge>
                </>
              )}
            </div>

            {/* Description */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-text-secondary">Description</h4>
              <div className="rounded-md bg-secondary-50 p-3">
                {selectedItem?.description ? (
                  <p className="text-text-dark whitespace-pre-wrap text-sm">
                    {selectedItem.description}
                  </p>
                ) : (
                  <p className="text-sm italic text-text-secondary">No description provided</p>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => setSelectedItem(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
