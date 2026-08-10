"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { DataTableProps, ViewData } from "./types";
import { useDataTableState } from "./hooks";
import { DataTableToolbar } from "./data-table-toolbar";
import { DataTablePagination } from "./data-table-pagination";
import { TableView } from "./table-view";
import { BoardView } from "./board-view";
import { SaveViewDialog, LoadViewDialog } from "./data-table-views";

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function DataTable<T>({
  data,
  columns,
  storageKey,
  
  // Search
  searchable = false,
  searchPlaceholder = "Search...",
  searchKeys,
  searchFn,
  
  // Views
  enableBoardView = false,
  boardGroupBy,
  boardGroupConfig = {},
  boardGroupOrder,
  renderBoardCard,
  
  // Saved views
  savedViews = [],
  onSaveView,
  onUpdateView,
  onDeleteView,
  
  // Default filters
  defaultFilters,
  
  // URL filters
  urlFilters,
  
  // Default sort
  defaultSort,
  
  // Pagination
  pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  disablePagination = false,
  
  // Row interaction
  getRowId,
  onRowClick,
  
  // Highlighting
  highlightIds = [],
  onHighlightClear,
  
  // Actions
  renderActions,
  headerActions,
  
  // Empty state
  emptyMessage = "No items found.",
  emptyFilteredMessage = "No items match your filters.",
  
  // Styling
  className,
  clickableRows = true,
}: DataTableProps<T>) {
  // State management
  const {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    sort,
    toggleSort,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems,
    sortedData,
    paginatedData,
    currentViewMatch,
    loadView,
    getCurrentViewState,
  } = useDataTableState({
    data,
    columns,
    storageKey,
    searchKeys,
    searchFn,
    initialPageSize,
    disablePagination,
    enableBoardView,
    savedViews,
    defaultFilters,
    defaultSort,
    urlFilters,
  });

  // View dialogs state
  const [isSaveViewOpen, setIsSaveViewOpen] = useState(false);
  const [isLoadViewOpen, setIsLoadViewOpen] = useState(false);

  // Clear highlights after delay
  useEffect(() => {
    if (highlightIds.length > 0 && onHighlightClear) {
      const timeout = setTimeout(() => {
        onHighlightClear();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [highlightIds, onHighlightClear]);

  // Handle save view
  const handleSaveView = useCallback(
    async (name: string) => {
      if (!onSaveView) return;
      
      const viewState = getCurrentViewState();
      await onSaveView({
        ...viewState,
        name,
      });
    },
    [onSaveView, getCurrentViewState]
  );

  // Handle update view
  const handleUpdateView = useCallback(
    async (id: string, data: Partial<ViewData>) => {
      if (!onUpdateView) return;
      await onUpdateView(id, data);
    },
    [onUpdateView]
  );

  // Handle delete view
  const handleDeleteView = useCallback(
    async (id: string) => {
      if (!onDeleteView) return;
      await onDeleteView(id);
    },
    [onDeleteView]
  );

  // Determine empty message
  const displayEmptyMessage = hasActiveFilters || searchQuery
    ? emptyFilteredMessage
    : emptyMessage;

  // Data to display (paginated for table, full sorted for board)
  const displayData = viewMode === "table" && !disablePagination
    ? paginatedData
    : sortedData;

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-background", className)}>
      {/* Toolbar */}
      <DataTableToolbar
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        enableBoardView={enableBoardView}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        columns={columns}
        filters={filters}
        onFilterChange={setFilter}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        savedViews={savedViews}
        currentViewMatch={currentViewMatch}
        onOpenSaveView={() => setIsSaveViewOpen(true)}
        onOpenLoadView={() => setIsLoadViewOpen(true)}
        enableSaveView={!!onSaveView}
        totalItems={data.length}
        filteredItems={totalItems}
        headerActions={headerActions}
      />

      {/* Table View */}
      {viewMode === "table" && (
        <TableView
          data={displayData}
          columns={columns}
          sort={sort}
          onSort={toggleSort}
          getRowId={getRowId}
          onRowClick={onRowClick}
          clickableRows={clickableRows}
          highlightIds={highlightIds}
          renderActions={renderActions}
          emptyMessage={displayEmptyMessage}
        />
      )}

      {/* Board View */}
      {viewMode === "board" && boardGroupBy && (
        <div className="p-4">
          <BoardView
            data={sortedData}
            columns={columns}
            groupBy={boardGroupBy as string}
            groupConfig={boardGroupConfig}
            groupOrder={boardGroupOrder}
            getRowId={getRowId}
            onRowClick={onRowClick}
            highlightIds={highlightIds}
            renderCard={renderBoardCard}
            emptyMessage={displayEmptyMessage}
          />
        </div>
      )}

      {/* Pagination (only for table view) */}
      {viewMode === "table" && !disablePagination && totalItems > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          pageSizeOptions={pageSizeOptions}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      )}

      {/* Save View Dialog */}
      {onSaveView && (
        <SaveViewDialog
          open={isSaveViewOpen}
          onOpenChange={setIsSaveViewOpen}
          onSave={handleSaveView}
          currentState={getCurrentViewState()}
        />
      )}

      {/* Load View Dialog */}
      {savedViews.length > 0 && (
        <LoadViewDialog
          open={isLoadViewOpen}
          onOpenChange={setIsLoadViewOpen}
          views={savedViews}
          currentViewId={currentViewMatch?.id}
          onLoad={loadView}
          onUpdate={handleUpdateView}
          onDelete={handleDeleteView}
        />
      )}
    </div>
  );
}
