"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  KanbanSquare,
  Search,
  Table2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CrmFilterBuilder } from "./filter-builder";
import { getColumnTypeIcon } from "./field-picker";
import { CrmSortPicker } from "./sort-picker";
import type {
  CrmColumnDef,
  CrmFilterGroup,
  CrmSortState,
  CrmTableProps,
} from "./types";
import {
  MIN_COLUMN_WIDTH,
  countActiveConditions,
  createFilterGroup,
  formatAbsoluteDate,
  formatRelativeTime,
  getColumnValue,
  getColumnWidth,
  loadCrmTablePreferences,
  matchesFilterGroup,
  normaliseFilterGroup,
  saveCrmTablePreferences,
  sortRows,
} from "./utils";

const SELECT_COLUMN_WIDTH = 40;
const ACTIONS_COLUMN_WIDTH = 60;

const cellPadding = "px-3 py-0";
const rowHeight = "h-9";

/**
 * Spreadsheet-style CRM table: the identity column stays pinned to the left
 * while the rest scroll horizontally, the header stays pinned to the top, and
 * columns can be resized. Filtering, sorting and search all run client-side
 * over the full row array.
 */
export function CrmTable<T>({
  data,
  columns,
  storageKey,
  getRowId,
  onRowClick,
  searchable = true,
  searchPlaceholder = "Search...",
  searchFn,
  defaultSort,
  pageSize: initialPageSize = 50,
  pageSizeOptions = [25, 50, 100, 200],
  headerActions,
  renderActions,
  rowLabel = "row",
  emptyMessage = "Nothing here yet.",
  emptyFilteredMessage = "Nothing matches your search or filters.",
  enableBoardView,
  renderBoardView,
  enableRowSelection = false,
  renderBulkActions,
  className,
}: CrmTableProps<T>) {
  const [hydrated, setHydrated] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "board">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<CrmFilterGroup>(createFilterGroup);
  const [sort, setSort] = useState<CrmSortState>(
    defaultSort ?? { column: null, direction: "asc" }
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isScrolledX, setIsScrolledX] = useState(false);

  useEffect(() => {
    const stored = loadCrmTablePreferences(storageKey);
    if (stored.viewMode) setViewMode(stored.viewMode);
    if (stored.filters || stored.conditions) {
      setFilters(normaliseFilterGroup(stored.filters ?? stored.conditions));
    }
    if (stored.columnWidths) setColumnWidths(stored.columnWidths);
    if (stored.pageSize) setPageSize(stored.pageSize);
    // A stored sort is ignored when its column has since been renamed or
    // removed, so the toolbar never shows a sort that does nothing.
    const storedSortExists =
      stored.sortColumn &&
      columns.some(
        (column) => column.id === stored.sortColumn && column.sortable
      );
    if (storedSortExists) {
      setSort({
        column: stored.sortColumn ?? null,
        direction: stored.sortDirection ?? "asc",
      });
    }
    setHydrated(true);
    // Columns are declared statically per page, so they are deliberately not a
    // dependency: re-reading storage would clobber the user's current sort.
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    saveCrmTablePreferences(storageKey, {
      viewMode,
      sortColumn: sort.column,
      sortDirection: sort.direction,
      filters,
      columnWidths,
      pageSize,
    });
  }, [hydrated, storageKey, viewMode, sort, filters, columnWidths, pageSize]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim();
    // One "now" per pass so relative date operators cannot shift mid-filter
    const now = new Date();
    return data.filter((row) => {
      if (query && searchFn && !searchFn(row, query)) return false;
      return matchesFilterGroup(row, columns, filters, now);
    });
  }, [data, columns, filters, searchQuery, searchFn]);

  const sortedRows = useMemo(() => {
    if (!sort.column) return filteredRows;
    const column = columns.find((entry) => entry.id === sort.column);
    return sortRows(filteredRows, column, sort.direction);
  }, [filteredRows, columns, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * pageSize;
  const pageRows = useMemo(
    () => sortedRows.slice(startIndex, startIndex + pageSize),
    [sortedRows, startIndex, pageSize]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, pageSize, sort]);

  const toggleSort = (columnId: string) => {
    setSort((current) => {
      if (current.column !== columnId) {
        return { column: columnId, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { column: columnId, direction: "desc" };
      }
      return { column: null, direction: "asc" };
    });
  };

  // Pinned columns are frozen to the left in the order they were declared,
  // after the selection checkbox when it is enabled.
  const pinnedColumns = columns.filter((column) => column.pinned);
  const scrollingColumns = columns.filter((column) => !column.pinned);

  const widthFor = useCallback(
    (column: CrmColumnDef<T>) => getColumnWidth(column, columnWidths),
    [columnWidths]
  );

  const pinnedOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let offset = enableRowSelection ? SELECT_COLUMN_WIDTH : 0;
    for (const column of pinnedColumns) {
      offsets[column.id] = offset;
      offset += widthFor(column);
    }
    return offsets;
  }, [pinnedColumns, widthFor, enableRowSelection]);

  const pinnedTotalWidth =
    (enableRowSelection ? SELECT_COLUMN_WIDTH : 0) +
    pinnedColumns.reduce((total, column) => total + widthFor(column), 0);

  const tableWidth =
    pinnedTotalWidth +
    scrollingColumns.reduce((total, column) => total + widthFor(column), 0) +
    (renderActions ? ACTIONS_COLUMN_WIDTH : 0);

  // Resizing
  const resizeState = useRef<{
    columnId: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const active = resizeState.current;
      if (!active) return;
      const next = Math.max(
        MIN_COLUMN_WIDTH,
        active.startWidth + (event.clientX - active.startX)
      );
      setColumnWidths((current) => ({ ...current, [active.columnId]: next }));
    };

    const handleUp = () => {
      resizeState.current = null;
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

  const startResize = (
    event: React.PointerEvent,
    column: CrmColumnDef<T>
  ) => {
    event.preventDefault();
    event.stopPropagation();
    resizeState.current = {
      columnId: column.id,
      startX: event.clientX,
      startWidth: widthFor(column),
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  // Selection
  const pageIds = pageRows.map(getRowId);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const toggleAllOnPage = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedRows = useMemo(
    () => data.filter((row) => selectedIds.has(getRowId(row))),
    [data, selectedIds, getRowId]
  );

  const hasFilters =
    countActiveConditions(filters) > 0 || searchQuery.trim().length > 0;

  const orderedColumns = [...pinnedColumns, ...scrollingColumns];

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {searchable && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-tertiary" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 pl-8 text-sm"
              />
            </div>
          )}

          <CrmSortPicker columns={columns} sort={sort} onChange={setSort} />

          <CrmFilterBuilder
            columns={columns}
            filters={filters}
            onChange={setFilters}
          />
        </div>

        <div className="flex items-center gap-2">
          {enableBoardView && renderBoardView && (
            <div className="flex items-center rounded border border-border p-0.5">
              <button
                type="button"
                aria-label="Table view"
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex h-6 items-center gap-1 rounded px-2 text-xs transition-colors",
                  viewMode === "table"
                    ? "bg-background-secondary text-text"
                    : "text-text-secondary"
                )}
              >
                <Table2 className="size-3" />
                Table
              </button>
              <button
                type="button"
                aria-label="Board view"
                onClick={() => setViewMode("board")}
                className={cn(
                  "flex h-6 items-center gap-1 rounded px-2 text-xs transition-colors",
                  viewMode === "board"
                    ? "bg-background-secondary text-text"
                    : "text-text-secondary"
                )}
              >
                <KanbanSquare className="size-3" />
                Board
              </button>
            </div>
          )}
          {headerActions}
        </div>
      </div>

      {viewMode === "board" && renderBoardView ? (
        renderBoardView()
      ) : (
        <>
          <div
            onScroll={(event) =>
              setIsScrolledX(event.currentTarget.scrollLeft > 0)
            }
            className="relative max-h-[calc(100vh-18rem)] overflow-auto rounded-md border border-border bg-background dark:border-border-dark dark:bg-background-dark"
          >
            <table
              className="border-separate border-spacing-0 text-[13px]"
              style={{ tableLayout: "fixed", width: tableWidth }}
            >
              <colgroup>
                {enableRowSelection && (
                  <col style={{ width: SELECT_COLUMN_WIDTH }} />
                )}
                {orderedColumns.map((column) => (
                  <col key={column.id} style={{ width: widthFor(column) }} />
                ))}
                {renderActions && (
                  <col style={{ width: ACTIONS_COLUMN_WIDTH }} />
                )}
              </colgroup>

              <thead>
                <tr>
                  {enableRowSelection && (
                    <th
                      style={{ left: 0 }}
                      className={cn(
                        "sticky top-0 z-30 border-b border-r border-border bg-background-secondary px-3 dark:border-border-dark dark:bg-background-dark-secondary",
                        rowHeight,
                        isScrolledX && "shadow-[2px_0_4px_rgba(0,0,0,0.06)]"
                      )}
                    >
                      <Checkbox
                        checked={allPageSelected}
                        onCheckedChange={toggleAllOnPage}
                        aria-label="Select all rows on this page"
                      />
                    </th>
                  )}

                  {orderedColumns.map((column) => {
                    const Icon = getColumnTypeIcon(column.type);
                    const isPinned = Boolean(column.pinned);
                    const isSorted = sort.column === column.id;
                    const isLastPinned =
                      isPinned &&
                      pinnedColumns[pinnedColumns.length - 1]?.id === column.id;

                    return (
                      <th
                        key={column.id}
                        style={
                          isPinned ? { left: pinnedOffsets[column.id] } : undefined
                        }
                        className={cn(
                          "group/header sticky top-0 border-b border-r border-border bg-background-secondary text-left font-medium text-text-secondary dark:border-border-dark dark:bg-background-dark-secondary",
                          cellPadding,
                          rowHeight,
                          isPinned ? "z-30" : "z-20",
                          isLastPinned &&
                            isScrolledX &&
                            "shadow-[2px_0_4px_rgba(0,0,0,0.06)]"
                        )}
                      >
                        <button
                          type="button"
                          disabled={!column.sortable}
                          onClick={() => column.sortable && toggleSort(column.id)}
                          className={cn(
                            "flex w-full items-center gap-1.5 overflow-hidden text-left",
                            column.sortable && "cursor-pointer"
                          )}
                        >
                          <Icon className="size-3 shrink-0 text-text-tertiary" />
                          <span className="truncate">{column.header}</span>
                          {column.sortable &&
                            (isSorted ? (
                              sort.direction === "asc" ? (
                                <ArrowUp className="size-3 shrink-0" />
                              ) : (
                                <ArrowDown className="size-3 shrink-0" />
                              )
                            ) : (
                              <ArrowUpDown className="size-3 shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover/header:opacity-100" />
                            ))}
                        </button>

                        <span
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Resize ${column.header}`}
                          onPointerDown={(event) => startResize(event, column)}
                          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-border-accent"
                        />
                      </th>
                    );
                  })}

                  {renderActions && (
                    <th
                      className={cn(
                        "sticky top-0 z-20 border-b border-border bg-background-secondary dark:border-border-dark dark:bg-background-dark-secondary",
                        cellPadding,
                        rowHeight
                      )}
                    >
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={
                        orderedColumns.length +
                        (enableRowSelection ? 1 : 0) +
                        (renderActions ? 1 : 0)
                      }
                      className="px-3 py-10 text-center text-text-secondary"
                    >
                      {hasFilters ? emptyFilteredMessage : emptyMessage}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => {
                    const rowId = getRowId(row);
                    const isSelected = selectedIds.has(rowId);

                    return (
                      <tr
                        key={rowId}
                        onClick={() => onRowClick?.(row)}
                        className={cn(
                          "group/row",
                          onRowClick && "cursor-pointer",
                          isSelected && "bg-primary-50 dark:bg-background-dark-tertiary"
                        )}
                      >
                        {enableRowSelection && (
                          <td
                            style={{ left: 0 }}
                            onClick={(event) => event.stopPropagation()}
                            className={cn(
                              "sticky z-10 border-b border-r border-border px-3 dark:border-border-dark",
                              rowHeight,
                              isSelected
                                ? "bg-primary-50 dark:bg-background-dark-tertiary"
                                : "bg-background group-hover/row:bg-background-secondary dark:bg-background-dark dark:group-hover/row:bg-background-dark-secondary",
                              isScrolledX && "shadow-[2px_0_4px_rgba(0,0,0,0.06)]"
                            )}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleRow(rowId)}
                              aria-label="Select row"
                            />
                          </td>
                        )}

                        {orderedColumns.map((column) => {
                          const isPinned = Boolean(column.pinned);
                          const isLastPinned =
                            isPinned &&
                            pinnedColumns[pinnedColumns.length - 1]?.id ===
                              column.id;

                          return (
                            <td
                              key={column.id}
                              style={
                                isPinned
                                  ? { left: pinnedOffsets[column.id] }
                                  : undefined
                              }
                              className={cn(
                                "overflow-hidden border-b border-r border-border align-middle text-text dark:border-border-dark dark:text-text-inverse",
                                cellPadding,
                                rowHeight,
                                isPinned && "sticky z-10",
                                isPinned &&
                                  (isSelected
                                    ? "bg-primary-50 dark:bg-background-dark-tertiary"
                                    : "bg-background group-hover/row:bg-background-secondary dark:bg-background-dark dark:group-hover/row:bg-background-dark-secondary"),
                                !isPinned &&
                                  "group-hover/row:bg-background-secondary dark:group-hover/row:bg-background-dark-secondary",
                                isLastPinned &&
                                  isScrolledX &&
                                  "shadow-[2px_0_4px_rgba(0,0,0,0.06)]"
                              )}
                            >
                              <DefaultCell column={column} row={row} />
                            </td>
                          );
                        })}

                        {renderActions && (
                          <td
                            onClick={(event) => event.stopPropagation()}
                            className={cn(
                              "border-b border-border text-right dark:border-border-dark",
                              cellPadding,
                              rowHeight,
                              "group-hover/row:bg-background-secondary dark:group-hover/row:bg-background-dark-secondary"
                            )}
                          >
                            {renderActions(row)}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 text-xs text-text-secondary sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span>
                {sortedRows.length.toLocaleString()} count
                {sortedRows.length !== data.length && (
                  <span className="text-text-tertiary">
                    {" "}
                    of {data.length.toLocaleString()}
                  </span>
                )}
              </span>

              {enableRowSelection && selectedIds.size > 0 && (
                <span className="flex items-center gap-2">
                  <span>{selectedIds.size} selected</span>
                  {renderBulkActions?.(selectedRows)}
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-text-accent hover:underline"
                  >
                    Clear
                  </button>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5">
                <span className="sr-only">Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="h-7 rounded border border-border bg-background px-1.5 text-xs text-text dark:border-border-dark dark:bg-background-dark"
                >
                  {pageSizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span>per page</span>
              </label>

              <span>
                {sortedRows.length === 0
                  ? `No ${rowLabel}s`
                  : `${(startIndex + 1).toLocaleString()}–${Math.min(
                    startIndex + pageSize,
                    sortedRows.length
                  ).toLocaleString()}`}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={page <= 1}
                  onClick={() => setCurrentPage(page - 1)}
                  className="flex size-7 items-center justify-center rounded border border-border transition-colors hover:bg-background-secondary disabled:opacity-40 dark:border-border-dark"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={page >= totalPages}
                  onClick={() => setCurrentPage(page + 1)}
                  className="flex size-7 items-center justify-center rounded border border-border transition-colors hover:bg-background-secondary disabled:opacity-40 dark:border-border-dark"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Falls back to a type-appropriate rendering when a column has no cell. */
function DefaultCell<T>({
  column,
  row,
}: {
  column: CrmColumnDef<T>;
  row: T;
}) {
  if (column.cell) return <>{column.cell(row)}</>;

  const value = getColumnValue(row, column);

  if (value === null || value === undefined || value === "") {
    return <span className="text-text-tertiary">—</span>;
  }

  if (column.type === "date") {
    const date = value instanceof Date ? value : new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return (
        <span className="truncate" title={formatRelativeTime(date)}>
          {formatAbsoluteDate(date)}
        </span>
      );
    }
  }

  return <span className="block truncate">{String(value)}</span>;
}
