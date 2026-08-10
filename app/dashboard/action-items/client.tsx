"use client";

import { useState, useCallback, useMemo } from "react";
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
  MoreHorizontal,
  Pencil,
  Trash2,
  Building2,
  AlertCircle,
  Clock,
  CheckCircle2,
  Circle,
  Ban,
  Eye,
} from "lucide-react";
import { 
  createActionItem, 
  updateActionItem, 
  deleteActionItem,
  createActionItemView,
  updateActionItemView,
  deleteActionItemView,
  ActionItemViewData,
} from "@/lib/actions";
import { DataTable, ColumnDef, ViewData } from "@/components/data-table";

// ============================================
// Types
// ============================================

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
  createdAt: Date;
  updatedAt: Date;
}

interface CompanyData {
  id: string;
  name: string;
  status: CompanyStatus;
  _count: {
    users: number;
  };
}

interface ActionItemsClientProps {
  actionItems: ActionItemData[];
  clientCompanies: CompanyData[];
  userRole: "ADMIN" | "DEVELOPER";
  savedViews: ActionItemViewData[];
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

export function ActionItemsClient({ actionItems: initialActionItems, clientCompanies, savedViews: initialSavedViews }: ActionItemsClientProps) {
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

  const [actionItems, setActionItems] = useState<ActionItemData[]>(initialActionItems);
  const [selectedItem, setSelectedItem] = useState<ActionItemData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [savedViews, setSavedViews] = useState<ActionItemViewData[]>(initialSavedViews);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    priority: "MEDIUM" as TaskPriority,
    status: "TODO" as TaskStatus,
    clientCompanyId: "",
  });

  // Admins and developers can edit any action item, including its status (developers can
  // now move items out of PENDING_ADMIN_REVIEW themselves).
  const canEditSelectedItem = true;

  // ============================================
  // Column Definitions
  // ============================================

  const columns: ColumnDef<ActionItemData>[] = useMemo(() => [
    {
      id: "name",
      header: "Action Item",
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
        const order = { PENDING_ADMIN_REVIEW: 0, TODO: 1, IN_PROGRESS: 2, BLOCKED: 3, DONE: 4 };
        const comparison = order[a.status] - order[b.status];
        return direction === "asc" ? comparison : -comparison;
      },
      filterable: true,
      filterType: "multi-select",
      filterOptions: (["PENDING_ADMIN_REVIEW", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as TaskStatus[]).map((s) => ({
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
  ], [clientCompanies]);

  // ============================================
  // Handlers
  // ============================================

  const handleClearHighlight = useCallback(() => {
    router.replace("/dashboard/action-items", { scroll: false });
  }, [router]);

  const handleEditItem = useCallback((item: ActionItemData) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      priority: item.priority,
      status: item.status,
      clientCompanyId: item.clientCompanyId,
    });
    setIsEditModalOpen(true);
  }, []);

  const handleCreateItem = () => {
    setFormData({
      name: "",
      description: "",
      priority: "MEDIUM",
      status: "TODO",
      clientCompanyId: purchasedClientCompanies[0]?.id || "",
    });
    setIsCreateModalOpen(true);
  };

  const handleDeleteItem = (item: ActionItemData) => {
    setSelectedItem(item);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmitCreate = async () => {
    if (!formData.name || !formData.clientCompanyId) return;

    const itemId = createId();
    const clientCompany = purchasedClientCompanies.find((c) => c.id === formData.clientCompanyId);

    const optimisticItem: ActionItemData = {
      id: itemId,
      name: formData.name,
      description: formData.description || null,
      priority: formData.priority,
      status: formData.status,
      clientCompanyId: formData.clientCompanyId,
      clientCompany: {
        id: clientCompany?.id || "",
        name: clientCompany?.name || "",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setActionItems((prev) => [optimisticItem, ...prev]);
    setIsCreateModalOpen(false);

    try {
      const result = await createActionItem({
        id: itemId,
        name: formData.name,
        description: formData.description || undefined,
        priority: formData.priority,
        status: formData.status,
        clientCompanyId: formData.clientCompanyId,
      });

      if (result.error) {
        setActionItems((prev) => prev.filter((i) => i.id !== itemId));
        alert(result.error);
      }
    } catch {
      setActionItems((prev) => prev.filter((i) => i.id !== itemId));
      alert("Failed to create action item");
    }
  };

  const handleSubmitEdit = async () => {
    if (!selectedItem || !formData.name || !formData.clientCompanyId) return;

    const clientCompany = purchasedClientCompanies.find((c) => c.id === formData.clientCompanyId);
    const previousItems = [...actionItems];

    const optimisticItem: ActionItemData = {
      ...selectedItem,
      name: formData.name,
      description: formData.description || null,
      priority: formData.priority,
      status: formData.status,
      clientCompanyId: formData.clientCompanyId,
      clientCompany: {
        id: clientCompany?.id || "",
        name: clientCompany?.name || "",
      },
      updatedAt: new Date(),
    };

    setActionItems((prev) => prev.map((i) => (i.id === selectedItem.id ? optimisticItem : i)));
    setIsEditModalOpen(false);
    setSelectedItem(null);

    try {
      const result = await updateActionItem(selectedItem.id, {
        name: formData.name,
        description: formData.description || null,
        priority: formData.priority,
        status: formData.status,
        clientCompanyId: formData.clientCompanyId,
      });

      if (result.error) {
        setActionItems(previousItems);
        alert(result.error);
      } else if (result.data) {
        setActionItems((prev) =>
          prev.map((i) => (i.id === selectedItem.id ? result.data : i))
        );
      }
    } catch {
      setActionItems(previousItems);
      alert("Failed to update action item");
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedItem) return;

    const previousItems = [...actionItems];
    setActionItems((prev) => prev.filter((i) => i.id !== selectedItem.id));
    setIsDeleteDialogOpen(false);
    const itemToDelete = selectedItem;
    setSelectedItem(null);

    try {
      const result = await deleteActionItem(itemToDelete.id);
      if (result.error) {
        setActionItems(previousItems);
        alert(result.error);
      }
    } catch {
      setActionItems(previousItems);
      alert("Failed to delete action item");
    }
  };

  // ============================================
  // View Management
  // ============================================

  // Convert ActionItemViewData to ViewData format for DataTable
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
      },
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
    }));
  }, [savedViews]);

  const handleSaveView = async (view: Omit<ViewData, "id" | "createdAt" | "updatedAt">) => {
    const result = await createActionItemView({
      name: view.name,
      viewMode: view.viewMode,
      sortColumn: view.sortColumn,
      sortDirection: view.sortDirection,
      statusFilters: (view.filters.status as string[]) || [],
      priorityFilters: (view.filters.priority as string[]) || [],
      clientFilters: (view.filters.client as string[]) || [],
    });

    if (result.error) {
      throw new Error(result.error);
    }

    if (result.data) {
      setSavedViews((prev) => [...prev, result.data!].sort((a, b) => a.name.localeCompare(b.name)));
    }
  };

  const handleUpdateView = async (id: string, data: Partial<ViewData>) => {
    const result = await updateActionItemView(id, { name: data.name });
    if (result.data) {
      setSavedViews((prev) =>
        prev
          .map((v) => (v.id === id ? { ...v, name: data.name || v.name } : v))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    }
  };

  const handleDeleteView = async (id: string) => {
    const result = await deleteActionItemView(id);
    if (result.data) {
      setSavedViews((prev) => prev.filter((v) => v.id !== id));
    }
  };

  // ============================================
  // Render Actions
  // ============================================

  const renderActions = useCallback((item: ActionItemData) => {
    // Admins and developers can both edit and delete any action item.
    const canEdit = true;
    const canDelete = true;
    
    if (!canEdit && !canDelete) return null;
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                handleEditItem(item);
              }}
            >
              <Pencil className="mr-2 size-4" />
              Edit
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              className="text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteItem(item);
              }}
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }, [handleEditItem]);

  // ============================================
  // Board View Card Renderer
  // ============================================

  const renderBoardCard = useCallback((item: ActionItemData) => {
    const PriorityIcon = priorityConfig[item.priority].icon;
    return (
      <>
        <div className="mb-2 flex items-start justify-between">
          <p className="text-text-dark font-medium">{item.name}</p>
          <Badge className={`${priorityConfig[item.priority].color} border text-xs`}>
            <PriorityIcon className="mr-1 size-3" />
            {priorityConfig[item.priority].label}
          </Badge>
        </div>
        {item.description && (
          <p className="mb-2 line-clamp-2 text-sm text-text-secondary">
            {item.description}
          </p>
        )}
        <div className="flex items-center gap-1 text-xs text-text-secondary">
          <Building2 className="size-3" />
          {item.clientCompany.name}
        </div>
      </>
    );
  }, []);

  // ============================================
  // Custom Search Function
  // ============================================

  const searchFn = useCallback((item: ActionItemData, query: string) => {
    const q = query.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.clientCompany.name.toLowerCase().includes(q)
    );
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-text-dark text-2xl font-bold">Action Items</h1>
          <p className="text-text-secondary">Manage action items for clients</p>
        </div>
        <Button onClick={handleCreateItem}>
          <Plus className="mr-2 size-4" />
          New Action Item
        </Button>
      </div>

      {/* Data Table */}
      <DataTable
        data={actionItems}
        columns={columns}
        storageKey="action-items"
        searchable
        searchPlaceholder="Search action items..."
        searchFn={searchFn}
        enableBoardView
        boardGroupBy="status"
        boardGroupConfig={{
          PENDING_ADMIN_REVIEW: { label: "Pending Review", icon: Eye },
          TODO: { label: "Todo", icon: Circle },
          IN_PROGRESS: { label: "In Progress", icon: Clock },
          BLOCKED: { label: "Blocked", icon: Ban },
          DONE: { label: "Done", icon: CheckCircle2 },
        }}
        boardGroupOrder={["PENDING_ADMIN_REVIEW", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"]}
        renderBoardCard={renderBoardCard}
        getRowId={(item) => item.id}
        onRowClick={handleEditItem}
        highlightIds={highlightIds}
        onHighlightClear={handleClearHighlight}
        renderActions={renderActions}
        pageSize={25}
        emptyMessage="No action items yet. Create your first action item."
        emptyFilteredMessage="No action items found matching your search or filters."
        savedViews={convertedViews}
        onSaveView={handleSaveView}
        onUpdateView={handleUpdateView}
        onDeleteView={handleDeleteView}
        defaultSort={{ column: "createdAt", direction: "desc" }}
      />

      {/* Create/Edit/View Modal */}
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
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Building2 className="size-4 text-text-secondary" />
            <span className="text-sm text-text-secondary">
              {purchasedClientCompanies.find((c) => c.id === formData.clientCompanyId)?.name || "Select client"}
            </span>
            <span className="text-text-secondary">&rsaquo;</span>
            <span className="text-sm font-medium">
              {isCreateModalOpen ? "New action item" : (canEditSelectedItem ? "Edit action item" : "View action item")}
            </span>
          </div>

          {/* Title & Description */}
          <div className="flex flex-1 flex-col px-4">
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Action item title"
              className="border-0 px-0 text-xl font-medium shadow-none focus-visible:ring-0"
              disabled={isEditModalOpen && !canEditSelectedItem}
            />
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add description..."
              className="mt-2 flex-1 resize-none border-0 px-0 text-text-secondary shadow-none focus-visible:ring-0"
              disabled={isEditModalOpen && !canEditSelectedItem}
            />
          </div>

          {/* Properties Row */}
          <div className="flex flex-wrap items-center gap-2 p-4">
            {/* Status */}
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as TaskStatus })}
              disabled={isEditModalOpen && !canEditSelectedItem}
            >
              <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3" disabled={isEditModalOpen && !canEditSelectedItem}>
                {(() => {
                  const StatusIcon = statusConfig[formData.status].icon;
                  return <StatusIcon className="size-4" />;
                })()}
                <span className="text-sm">{statusConfig[formData.status].label}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING_ADMIN_REVIEW">
                  <div className="flex items-center gap-2">
                    <Eye className="size-4" />
                    Pending Review
                  </div>
                </SelectItem>
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
              disabled={isEditModalOpen && !canEditSelectedItem}
            >
              <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3" disabled={isEditModalOpen && !canEditSelectedItem}>
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

            {/* Client Company - only show PURCHASED clients */}
            <Select
              value={formData.clientCompanyId}
              onValueChange={(value) => setFormData({ ...formData, clientCompanyId: value })}
              disabled={isEditModalOpen && !canEditSelectedItem}
            >
              <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3" disabled={isEditModalOpen && !canEditSelectedItem}>
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
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3">
            {isEditModalOpen && !canEditSelectedItem ? (
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditModalOpen(false);
                }}
              >
                Close
              </Button>
            ) : (
              <>
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
                  disabled={!formData.name || !formData.clientCompanyId}
                >
                  {isCreateModalOpen ? "Create" : "Save changes"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Action Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedItem?.name}&quot;? This action cannot be
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
    </div>
  );
}
