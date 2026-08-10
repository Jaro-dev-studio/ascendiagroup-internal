"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  LayoutList,
  Kanban,
  X,
  Save,
  FolderOpen,
  Check,
} from "lucide-react";
import { ColumnDef, FilterState, ViewData } from "./types";
import { DataTableFilters } from "./data-table-filters";

interface DataTableToolbarProps<T> {
  // Search
  searchable: boolean;
  searchPlaceholder: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  
  // View mode
  enableBoardView: boolean;
  viewMode: "table" | "board";
  onViewModeChange: (mode: "table" | "board") => void;
  
  // Filters
  columns: ColumnDef<T>[];
  filters: FilterState;
  onFilterChange: (columnId: string, value: FilterState[string]) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  
  // Views
  savedViews: ViewData[];
  currentViewMatch: ViewData | undefined;
  onOpenSaveView: () => void;
  onOpenLoadView: () => void;
  enableSaveView?: boolean;
  
  // Stats
  totalItems: number;
  filteredItems: number;
  
  // Header actions
  headerActions?: React.ReactNode;
}

export function DataTableToolbar<T>({
  // Search
  searchable,
  searchPlaceholder,
  searchQuery,
  onSearchChange,
  
  // View mode
  enableBoardView,
  viewMode,
  onViewModeChange,
  
  // Filters
  columns,
  filters,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
  activeFilterCount,
  
  // Views
  savedViews,
  currentViewMatch,
  onOpenSaveView,
  onOpenLoadView,
  enableSaveView = false,
  
  // Stats
  filteredItems,
  
  // Header actions
  headerActions,
}: DataTableToolbarProps<T>) {
  const filterableColumns = columns.filter((col) => col.filterable);

  return (
    <div className="flex flex-col gap-3 border-b border-border bg-background-secondary/30 p-3">
      {/* Top row: Search, View Toggle, Header Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        {searchable && (
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-text-secondary" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 border-border bg-background pl-9"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          {enableBoardView && (
            <div className="flex rounded border border-border bg-background p-0.5">
              <button
                onClick={() => onViewModeChange("table")}
                className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-sm transition-colors ${
                  viewMode === "table"
                    ? "bg-primary-600 text-white"
                    : "hover:text-text-dark text-text-secondary"
                }`}
              >
                <LayoutList className="size-4" />
                Table
              </button>
              <button
                onClick={() => onViewModeChange("board")}
                className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-sm transition-colors ${
                  viewMode === "board"
                    ? "bg-primary-600 text-white"
                    : "hover:text-text-dark text-text-secondary"
                }`}
              >
                <Kanban className="size-4" />
                Board
              </button>
            </div>
          )}

          {/* Header Actions */}
          {headerActions}
        </div>
      </div>

      {/* Bottom row: Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Load Saved View Button */}
        {savedViews.length > 0 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenLoadView}
              className="h-7 gap-1.5 px-2 text-xs"
            >
              <FolderOpen className="size-3" />
              Saved Views
              <span className="ml-1 flex size-4 items-center justify-center rounded-full bg-secondary-200 text-[10px] text-secondary-700">
                {savedViews.length}
              </span>
            </Button>
            <div className="h-4 w-px bg-border" />
          </>
        )}

        {/* Filter Popovers */}
        <DataTableFilters
          columns={filterableColumns}
          filters={filters}
          onFilterChange={onFilterChange}
        />

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="h-7 gap-1 px-2 text-xs"
          >
            <X className="size-3" />
            Clear ({activeFilterCount})
          </Button>
        )}

        {/* Save View Button */}
        {enableSaveView && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSaveView}
            className="h-7 gap-1.5 px-2 text-xs"
          >
            <Save className="size-3" />
            Save View
          </Button>
        )}

        {/* Stats and Current View */}
        <div className="ml-auto flex items-center gap-2 text-xs text-text-secondary">
          {currentViewMatch && (
            <span className="flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-primary-700">
              <Check className="size-3" />
              {currentViewMatch.name}
            </span>
          )}
          <span>
            {filteredItems} {filteredItems === 1 ? "item" : "items"}
          </span>
        </div>
      </div>
    </div>
  );
}
