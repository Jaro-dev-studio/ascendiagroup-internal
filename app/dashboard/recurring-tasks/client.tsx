"use client";

import { useState, useMemo, useCallback } from "react";
import { createId } from "@paralleldrive/cuid2";
import { CompanyStatus, TaskPriority } from "@prisma/client";
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
  User,
  Building2,
  AlertCircle,
  Clock,
  Circle,
  Repeat,
  Calendar,
  Power,
  PowerOff,
} from "lucide-react";
import {
  createRecurringTask,
  updateRecurringTask,
  deleteRecurringTask,
  toggleRecurringTaskActive,
  RecurringTaskData,
} from "@/lib/actions";

// ============================================
// Type Definitions
// ============================================

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

interface RecurringTasksClientProps {
  recurringTasks: RecurringTaskData[];
  clientCompanies: CompanyData[];
  users: UserData[];
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

const frequencyConfig = {
  DAILY: { label: "Daily", description: "Every day" },
  WEEKLY: { label: "Weekly", description: "Every week" },
  MONTHLY: { label: "Monthly", description: "Every month" },
};

const daysOfWeek = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

// ============================================
// Main Component
// ============================================

export function RecurringTasksClient({
  recurringTasks: initialRecurringTasks,
  clientCompanies,
  users,
}: RecurringTasksClientProps) {
  const [recurringTasks, setRecurringTasks] = useState<RecurringTaskData[]>(initialRecurringTasks);
  const [selectedTask, setSelectedTask] = useState<RecurringTaskData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter to only show PURCHASED (converted) clients in create/edit dropdowns
  const purchasedClientCompanies = useMemo(
    () => clientCompanies.filter((c) => c.status === "PURCHASED"),
    [clientCompanies]
  );

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    priority: "MEDIUM" as TaskPriority,
    frequency: "WEEKLY" as "DAILY" | "WEEKLY" | "MONTHLY",
    dayOfWeek: 1, // Monday
    dayOfMonth: 1,
    clientCompanyId: "",
    assigneeId: "",
  });

  // ============================================
  // Filtered Tasks
  // ============================================

  const filteredTasks = useMemo(() => {
    if (!searchQuery) return recurringTasks;
    const query = searchQuery.toLowerCase();
    return recurringTasks.filter(
      (task) =>
        task.name.toLowerCase().includes(query) ||
        task.clientCompany.name.toLowerCase().includes(query) ||
        (task.assignee?.email.toLowerCase().includes(query) ?? false)
    );
  }, [recurringTasks, searchQuery]);

  // ============================================
  // Handlers
  // ============================================

  const handleEditTask = useCallback((task: RecurringTaskData) => {
    setSelectedTask(task);
    setFormData({
      name: task.name,
      description: task.description || "",
      priority: task.priority,
      frequency: task.frequency,
      dayOfWeek: task.dayOfWeek ?? 1,
      dayOfMonth: task.dayOfMonth ?? 1,
      clientCompanyId: task.clientCompanyId,
      assigneeId: task.assigneeId || "",
    });
    setIsEditModalOpen(true);
  }, []);

  const handleCreateTask = () => {
    setFormData({
      name: "",
      description: "",
      priority: "MEDIUM",
      frequency: "WEEKLY",
      dayOfWeek: 1,
      dayOfMonth: 1,
      clientCompanyId: purchasedClientCompanies[0]?.id || "",
      assigneeId: "",
    });
    setIsCreateModalOpen(true);
  };

  const handleDeleteTask = (task: RecurringTaskData) => {
    setSelectedTask(task);
    setIsDeleteDialogOpen(true);
  };

  const handleToggleActive = async (task: RecurringTaskData) => {
    const previousTasks = [...recurringTasks];
    
    // Optimistic update
    setRecurringTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, isActive: !t.isActive } : t))
    );

    try {
      const result = await toggleRecurringTaskActive(task.id);
      if (result.error) {
        setRecurringTasks(previousTasks);
        alert(result.error);
      } else if (result.data) {
        setRecurringTasks((prev) =>
          prev.map((t) => (t.id === task.id ? result.data! : t))
        );
      }
    } catch {
      setRecurringTasks(previousTasks);
      alert("Failed to toggle recurring task");
    }
  };

  const handleSubmitCreate = async () => {
    if (!formData.name || !formData.clientCompanyId) return;

    const taskId = createId();
    const clientCompany = purchasedClientCompanies.find((c) => c.id === formData.clientCompanyId);
    const assignee = formData.assigneeId ? users.find((u) => u.id === formData.assigneeId) : null;

    const optimisticTask: RecurringTaskData = {
      id: taskId,
      name: formData.name,
      description: formData.description || null,
      priority: formData.priority,
      frequency: formData.frequency,
      dayOfWeek: formData.frequency === "WEEKLY" ? formData.dayOfWeek : null,
      dayOfMonth: formData.frequency === "MONTHLY" ? formData.dayOfMonth : null,
      isActive: true,
      lastCreatedAt: null,
      clientCompanyId: formData.clientCompanyId,
      clientCompany: {
        id: clientCompany?.id || "",
        name: clientCompany?.name || "",
      },
      assigneeId: formData.assigneeId || null,
      assignee: assignee ? { id: assignee.id, email: assignee.email, firstName: assignee.firstName } : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Optimistically add to list and close modal
    setRecurringTasks((prev) => [optimisticTask, ...prev]);
    setIsCreateModalOpen(false);

    try {
      const result = await createRecurringTask({
        name: formData.name,
        description: formData.description || undefined,
        priority: formData.priority,
        frequency: formData.frequency,
        dayOfWeek: formData.frequency === "WEEKLY" ? formData.dayOfWeek : undefined,
        dayOfMonth: formData.frequency === "MONTHLY" ? formData.dayOfMonth : undefined,
        clientCompanyId: formData.clientCompanyId,
        assigneeId: formData.assigneeId || undefined,
      });

      if (result.error) {
        // Revert optimistic update
        setRecurringTasks((prev) => prev.filter((t) => t.id !== taskId));
        alert(result.error);
      } else if (result.data) {
        // Update with real data
        setRecurringTasks((prev) => prev.map((t) => (t.id === taskId ? result.data! : t)));
      }
    } catch {
      setRecurringTasks((prev) => prev.filter((t) => t.id !== taskId));
      alert("Failed to create recurring task");
    }
  };

  const handleSubmitEdit = async () => {
    if (!selectedTask || !formData.name || !formData.clientCompanyId) return;

    const clientCompany = purchasedClientCompanies.find((c) => c.id === formData.clientCompanyId);
    const assignee = formData.assigneeId ? users.find((u) => u.id === formData.assigneeId) : null;

    const previousTasks = [...recurringTasks];

    const optimisticTask: RecurringTaskData = {
      ...selectedTask,
      name: formData.name,
      description: formData.description || null,
      priority: formData.priority,
      frequency: formData.frequency,
      dayOfWeek: formData.frequency === "WEEKLY" ? formData.dayOfWeek : null,
      dayOfMonth: formData.frequency === "MONTHLY" ? formData.dayOfMonth : null,
      clientCompanyId: formData.clientCompanyId,
      clientCompany: {
        id: clientCompany?.id || "",
        name: clientCompany?.name || "",
      },
      assigneeId: formData.assigneeId || null,
      assignee: assignee ? { id: assignee.id, email: assignee.email, firstName: assignee.firstName } : null,
      updatedAt: new Date(),
    };

    // Optimistically update and close modal
    setRecurringTasks((prev) => prev.map((t) => (t.id === selectedTask.id ? optimisticTask : t)));
    setIsEditModalOpen(false);
    setSelectedTask(null);

    try {
      const result = await updateRecurringTask(selectedTask.id, {
        name: formData.name,
        description: formData.description || undefined,
        priority: formData.priority,
        frequency: formData.frequency,
        dayOfWeek: formData.frequency === "WEEKLY" ? formData.dayOfWeek : null,
        dayOfMonth: formData.frequency === "MONTHLY" ? formData.dayOfMonth : null,
        clientCompanyId: formData.clientCompanyId,
        assigneeId: formData.assigneeId || null,
      });

      if (result.error) {
        setRecurringTasks(previousTasks);
        alert(result.error);
      } else if (result.data) {
        setRecurringTasks((prev) =>
          prev.map((t) => (t.id === selectedTask.id ? result.data! : t))
        );
      }
    } catch {
      setRecurringTasks(previousTasks);
      alert("Failed to update recurring task");
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedTask) return;

    const previousTasks = [...recurringTasks];

    // Optimistically remove and close dialog
    setRecurringTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));
    setIsDeleteDialogOpen(false);
    const taskToDelete = selectedTask;
    setSelectedTask(null);

    try {
      const result = await deleteRecurringTask(taskToDelete.id);
      if (result.error) {
        setRecurringTasks(previousTasks);
        alert(result.error);
      }
    } catch {
      setRecurringTasks(previousTasks);
      alert("Failed to delete recurring task");
    }
  };

  // ============================================
  // Helper Functions
  // ============================================

  const getFrequencyDescription = (task: RecurringTaskData) => {
    if (task.frequency === "DAILY") {
      return "Every day";
    } else if (task.frequency === "WEEKLY") {
      const day = daysOfWeek.find((d) => d.value === task.dayOfWeek);
      return `Every ${day?.label || "week"}`;
    } else if (task.frequency === "MONTHLY") {
      const suffix = getOrdinalSuffix(task.dayOfMonth || 1);
      return `${task.dayOfMonth}${suffix} of each month`;
    }
    return "";
  };

  const getOrdinalSuffix = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-text-dark text-2xl font-bold">Recurring Tasks</h1>
          <p className="text-text-secondary">Manage tasks that repeat on a schedule</p>
        </div>
        <Button onClick={handleCreateTask}>
          <Plus className="mr-2 size-4" />
          New Recurring Task
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
          <Input
            placeholder="Search recurring tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-background">
        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center">
            <Repeat className="mx-auto mb-3 size-12 text-text-secondary" />
            <h3 className="text-text-dark mb-1 text-lg font-medium">No recurring tasks</h3>
            <p className="text-text-secondary">
              {searchQuery
                ? "No recurring tasks match your search."
                : "Create your first recurring task to automate task creation."}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background-secondary">
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Task</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Client</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Schedule</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Priority</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Assignee</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Last Created</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const PriorityIcon = priorityConfig[task.priority].icon;
                return (
                  <tr
                    key={task.id}
                    className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-background-secondary"
                    onClick={() => handleEditTask(task)}
                  >
                    <td className="px-4 py-3">
                      <p className={`text-text-dark font-medium ${!task.isActive ? "opacity-50" : ""}`}>
                        {task.name}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 shrink-0 text-text-secondary" />
                        <span className="truncate text-sm">{task.clientCompany.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Repeat className="size-4 shrink-0 text-text-secondary" />
                        <span className="text-sm">{getFrequencyDescription(task)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${priorityConfig[task.priority].color} whitespace-nowrap border`}>
                        <PriorityIcon className="mr-1 size-3" />
                        {priorityConfig[task.priority].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {task.assignee ? (
                        <div className="flex items-center gap-2">
                          <User className="size-4 shrink-0 text-text-secondary" />
                          <span className="truncate text-sm">
                            {task.assignee.firstName || task.assignee.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-text-secondary">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          task.isActive
                            ? "border border-success-200 bg-success-100 text-success-700"
                            : "border border-secondary-200 bg-secondary-100 text-secondary-600"
                        }
                      >
                        {task.isActive ? "Active" : "Paused"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-text-secondary">
                        {task.lastCreatedAt
                          ? new Date(task.lastCreatedAt).toLocaleDateString()
                          : "Never"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(task);
                            }}
                          >
                            {task.isActive ? (
                              <>
                                <PowerOff className="mr-2 size-4" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Power className="mr-2 size-4" />
                                Activate
                              </>
                            )}
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog
        open={isCreateModalOpen || isEditModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateModalOpen(false);
            setIsEditModalOpen(false);
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden p-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Repeat className="size-4 text-text-secondary" />
              <span className="text-sm font-medium">
                {isCreateModalOpen ? "New Recurring Task" : "Edit Recurring Task"}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Title */}
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Task title"
              className="border-0 px-0 text-xl font-medium shadow-none focus-visible:ring-0"
            />

            {/* Description */}
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add description..."
              className="mt-2 min-h-[100px] resize-none border-0 px-0 text-text-secondary shadow-none focus-visible:ring-0"
            />

            {/* Properties Row */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
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

              {/* Client Company - only show PURCHASED clients */}
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
            </div>

            {/* Recurrence Settings */}
            <div className="mt-6 rounded-lg border border-border bg-background-secondary p-4">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-medium">
                <Calendar className="size-4" />
                Recurrence Schedule
              </h3>

              <div className="space-y-4">
                {/* Frequency */}
                <div>
                  <label className="mb-1.5 block text-sm text-text-secondary">Frequency</label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) =>
                      setFormData({ ...formData, frequency: value as "DAILY" | "WEEKLY" | "MONTHLY" })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <span>{frequencyConfig[formData.frequency].label}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Daily - Every day</SelectItem>
                      <SelectItem value="WEEKLY">Weekly - Once per week</SelectItem>
                      <SelectItem value="MONTHLY">Monthly - Once per month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Day of Week (for WEEKLY) */}
                {formData.frequency === "WEEKLY" && (
                  <div>
                    <label className="mb-1.5 block text-sm text-text-secondary">Day of Week</label>
                    <Select
                      value={String(formData.dayOfWeek)}
                      onValueChange={(value) => setFormData({ ...formData, dayOfWeek: parseInt(value) })}
                    >
                      <SelectTrigger className="w-full">
                        <span>{daysOfWeek.find((d) => d.value === formData.dayOfWeek)?.label}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {daysOfWeek.map((day) => (
                          <SelectItem key={day.value} value={String(day.value)}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Day of Month (for MONTHLY) */}
                {formData.frequency === "MONTHLY" && (
                  <div>
                    <label className="mb-1.5 block text-sm text-text-secondary">Day of Month</label>
                    <Select
                      value={String(formData.dayOfMonth)}
                      onValueChange={(value) => setFormData({ ...formData, dayOfMonth: parseInt(value) })}
                    >
                      <SelectTrigger className="w-full">
                        <span>
                          {formData.dayOfMonth}
                          {getOrdinalSuffix(formData.dayOfMonth)}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                          <SelectItem key={day} value={String(day)}>
                            {day}
                            {getOrdinalSuffix(day)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-text-secondary">
                      Days 29-31 will be skipped in shorter months
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3">
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
              {isCreateModalOpen ? "Create Recurring Task" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Recurring Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedTask?.name}&quot;? This will stop future tasks
              from being created. Existing tasks will not be affected.
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
