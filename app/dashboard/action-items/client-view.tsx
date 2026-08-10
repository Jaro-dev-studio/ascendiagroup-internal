"use client";

import { useState } from "react";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { Input } from "@/components/ui/input";
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
  Search,
  LayoutList,
  Kanban,
  AlertCircle,
  Clock,
  CheckCircle2,
  Circle,
  Ban,
  Eye,
} from "lucide-react";

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

interface ActionItemsClientViewProps {
  actionItems: ActionItemData[];
}

const priorityConfig = {
  URGENT: { label: "Urgent", color: "bg-danger-100 text-danger-700 border-danger-200", icon: AlertCircle },
  HIGH: { label: "High", color: "bg-warning-100 text-warning-700 border-warning-200", icon: AlertCircle },
  MEDIUM: { label: "Medium", color: "bg-warning-50 text-warning-600 border-warning-100", icon: Clock },
  LOW: { label: "Low", color: "bg-secondary-100 text-secondary-600 border-secondary-200", icon: Circle },
};

const statusConfig: Record<TaskStatus, { label: string; color: string; icon: typeof Circle }> = {
  PENDING_ADMIN_REVIEW: { label: "Pending Review", color: "bg-warning-100 text-warning-700 border-warning-200", icon: Eye },
  TODO: { label: "Todo", color: "bg-secondary-100 text-secondary-600 border-secondary-200", icon: Circle },
  IN_PROGRESS: { label: "In Progress", color: "bg-primary-100 text-primary-700 border-primary-200", icon: Clock },
  BLOCKED: { label: "Blocked", color: "bg-danger-100 text-danger-700 border-danger-200", icon: Ban },
  DONE: { label: "Done", color: "bg-success-100 text-success-700 border-success-200", icon: CheckCircle2 },
};

export function ActionItemsClientView({ actionItems: initialActionItems }: ActionItemsClientViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  const filteredItems = initialActionItems
    .filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Group items by status for Kanban view (PENDING_ADMIN_REVIEW excluded from display but needed for type safety)
  const itemsByStatus = {
    PENDING_ADMIN_REVIEW: filteredItems.filter((i) => i.status === "PENDING_ADMIN_REVIEW"),
    TODO: filteredItems.filter((i) => i.status === "TODO"),
    IN_PROGRESS: filteredItems.filter((i) => i.status === "IN_PROGRESS"),
    BLOCKED: filteredItems.filter((i) => i.status === "BLOCKED"),
    DONE: filteredItems.filter((i) => i.status === "DONE"),
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-text-dark text-2xl font-bold">Action Items</h1>
        <p className="text-text-secondary">View your action items</p>
      </div>

      {/* Search and View Toggle */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="text-text-dark pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search action items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("table")}
          >
            <LayoutList className="mr-2 size-4" />
            Table
          </Button>
          <Button
            variant={viewMode === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("kanban")}
          >
            <Kanban className="mr-2 size-4" />
            Board
          </Button>
        </div>
      </div>

      {/* Table View */}
      {viewMode === "table" && (
        <div className="rounded-lg border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50%]">Action Item</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-text-secondary">
                    {searchQuery ? "No action items found matching your search." : "No action items yet."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => {
                  const PriorityIcon = priorityConfig[item.priority].icon;
                  const StatusIcon = statusConfig[item.status].icon;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-[500px]">
                        <p className="text-text-dark truncate font-medium">{item.name}</p>
                        {item.description && (
                          <p className="mt-1 truncate text-sm text-text-secondary">{item.description}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusConfig[item.status].color} border`}>
                          <StatusIcon className="mr-1 size-3" />
                          {statusConfig[item.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${priorityConfig[item.priority].color} border`}>
                          <PriorityIcon className="mr-1 size-3" />
                          {priorityConfig[item.priority].label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Kanban View */}
      {viewMode === "kanban" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as TaskStatus[]).map((status) => {
            const StatusIcon = statusConfig[status].icon;
            return (
              <div
                key={status}
                className="rounded-lg border border-border bg-background-secondary/30 p-4"
              >
                <div className="mb-4 flex items-center gap-2">
                  <StatusIcon className="size-4 text-text-secondary" />
                  <h3 className="text-text-dark font-semibold">
                    {statusConfig[status].label}
                  </h3>
                  <Badge variant="outline" className="ml-auto">
                    {itemsByStatus[status].length}
                  </Badge>
                </div>
                <div className="flex flex-col gap-3">
                  {itemsByStatus[status].length === 0 ? (
                    <p className="py-4 text-center text-sm text-text-secondary">
                      No items
                    </p>
                  ) : (
                    itemsByStatus[status].map((item) => {
                      const PriorityIcon = priorityConfig[item.priority].icon;
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg border border-border bg-background p-3 shadow-sm"
                        >
                          <div className="mb-2 flex items-start justify-between">
                            <p className="text-text-dark font-medium">{item.name}</p>
                            <Badge
                              className={`${priorityConfig[item.priority].color} border text-xs`}
                            >
                              <PriorityIcon className="mr-1 size-3" />
                              {priorityConfig[item.priority].label}
                            </Badge>
                          </div>
                          {item.description && (
                            <p className="line-clamp-2 text-sm text-text-secondary">
                              {item.description}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
