import { ColumnDef, FilterState, FilterValue, DateRange, StoredPreferences, SortDirection } from "./types";

// ============================================
// Value Access Utilities
// ============================================

/**
 * Get a nested value from an object using dot notation
 * e.g., getNestedValue(obj, "company.name") returns obj.company.name
 */
export function getNestedValue<T>(obj: T, path: string): unknown {
  return path.split(".").reduce((acc: unknown, part: string) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

/**
 * Get the value for a column from a row
 */
export function getColumnValue<T>(row: T, column: ColumnDef<T>): unknown {
  if (column.accessorFn) {
    return column.accessorFn(row);
  }
  if (column.accessorKey) {
    if (typeof column.accessorKey === "string" && column.accessorKey.includes(".")) {
      return getNestedValue(row, column.accessorKey);
    }
    return row[column.accessorKey as keyof T];
  }
  return undefined;
}

// ============================================
// Search Utilities
// ============================================

/**
 * Check if a row matches the search query
 */
export function matchesSearch<T>(
  row: T,
  query: string,
  searchKeys?: string[],
  searchFn?: (row: T, query: string) => boolean
): boolean {
  if (!query.trim()) return true;

  // Use custom search function if provided
  if (searchFn) {
    return searchFn(row, query);
  }

  // Fall back to searchKeys-based search
  if (searchKeys?.length) {
    const q = query.toLowerCase();
    return searchKeys.some((key) => {
      const value = getNestedValue(row, key);
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(q);
    });
  }

  return true;
}

// ============================================
// Filter Utilities
// ============================================

/**
 * Check if a value is a DateRange
 */
export function isDateRange(value: FilterValue): value is DateRange {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    ("from" in value || "to" in value)
  );
}

/**
 * Check if a filter value is empty/unset
 */
export function isFilterEmpty(value: FilterValue): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value === "";
  if (Array.isArray(value)) return value.length === 0;
  if (isDateRange(value)) return value.from === null && value.to === null;
  return false;
}

/**
 * Check if a row matches a single filter
 */
export function matchesFilter<T>(
  row: T,
  column: ColumnDef<T>,
  filterValue: FilterValue
): boolean {
  if (isFilterEmpty(filterValue)) return true;

  // Use custom filter function if provided
  if (column.filterFn) {
    return column.filterFn(row, filterValue);
  }

  const cellValue = getColumnValue(row, column);

  // Handle multi-select filters
  if (Array.isArray(filterValue)) {
    if (filterValue.length === 0) return true;
    
    // Special handling for "unassigned" or null values
    if (filterValue.includes("unassigned") && (cellValue === null || cellValue === undefined)) {
      return true;
    }
    
    return filterValue.includes(String(cellValue));
  }

  // Handle date range filters
  if (isDateRange(filterValue)) {
    if (!cellValue) return false;
    const date = new Date(cellValue as string | number | Date);
    if (filterValue.from && date < filterValue.from) return false;
    if (filterValue.to && date > filterValue.to) return false;
    return true;
  }

  // Handle text/select filters
  if (typeof filterValue === "string") {
    if (filterValue === "") return true;
    return String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
  }

  return true;
}

/**
 * Check if a row matches all active filters
 */
export function matchesAllFilters<T>(
  row: T,
  columns: ColumnDef<T>[],
  filters: FilterState
): boolean {
  return Object.entries(filters).every(([columnId, filterValue]) => {
    const column = columns.find((c) => c.id === columnId);
    if (!column) return true; // Skip filters for non-existent columns
    return matchesFilter(row, column, filterValue);
  });
}

/**
 * Check if any filters are active
 */
export function hasActiveFilters(filters: FilterState): boolean {
  return Object.values(filters).some((value) => !isFilterEmpty(value));
}

/**
 * Get count of active filters
 */
export function getActiveFilterCount(filters: FilterState): number {
  return Object.values(filters).filter((value) => !isFilterEmpty(value)).length;
}

// ============================================
// Sort Utilities
// ============================================

/**
 * Default sort comparison function
 */
export function defaultSortCompare<T>(
  a: T,
  b: T,
  column: ColumnDef<T>,
  direction: SortDirection
): number {
  const aValue = getColumnValue(a, column);
  const bValue = getColumnValue(b, column);

  // Handle null/undefined
  if (aValue === null || aValue === undefined) return direction === "asc" ? 1 : -1;
  if (bValue === null || bValue === undefined) return direction === "asc" ? -1 : 1;

  let comparison = 0;

  // Handle different types
  if (typeof aValue === "string" && typeof bValue === "string") {
    comparison = aValue.localeCompare(bValue);
  } else if (typeof aValue === "number" && typeof bValue === "number") {
    comparison = aValue - bValue;
  } else if (aValue instanceof Date && bValue instanceof Date) {
    comparison = aValue.getTime() - bValue.getTime();
  } else {
    comparison = String(aValue).localeCompare(String(bValue));
  }

  return direction === "asc" ? comparison : -comparison;
}

/**
 * Sort data by column
 */
export function sortData<T>(
  data: T[],
  column: ColumnDef<T> | undefined,
  direction: SortDirection
): T[] {
  if (!column) return data;

  return [...data].sort((a, b) => {
    if (column.sortFn) {
      return column.sortFn(a, b, direction);
    }
    return defaultSortCompare(a, b, column, direction);
  });
}

// ============================================
// localStorage Utilities
// ============================================

const STORAGE_PREFIX = "datatable-";

/**
 * Get the storage key for a table
 */
export function getStorageKey(tableKey: string): string {
  return `${STORAGE_PREFIX}${tableKey}-preferences`;
}

/**
 * Load preferences from localStorage
 */
export function loadPreferences(storageKey: string): Partial<StoredPreferences> {
  if (typeof window === "undefined") return {};
  
  try {
    const stored = localStorage.getItem(getStorageKey(storageKey));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

/**
 * Save preferences to localStorage
 */
export function savePreferences(storageKey: string, preferences: StoredPreferences): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(getStorageKey(storageKey), JSON.stringify(preferences));
  } catch {
    // Ignore storage errors
  }
}

// ============================================
// View Utilities
// ============================================

/**
 * Check if two filter states are equal
 */
export function filtersEqual(a: FilterState, b: FilterState): boolean {
  const aKeys = Object.keys(a).filter((k) => !isFilterEmpty(a[k]));
  const bKeys = Object.keys(b).filter((k) => !isFilterEmpty(b[k]));

  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((key) => {
    const aVal = a[key];
    const bVal = b[key];

    if (Array.isArray(aVal) && Array.isArray(bVal)) {
      if (aVal.length !== bVal.length) return false;
      const sortedA = [...aVal].sort();
      const sortedB = [...bVal].sort();
      return sortedA.every((v, i) => v === sortedB[i]);
    }

    if (isDateRange(aVal) && isDateRange(bVal)) {
      return (
        aVal.from?.getTime() === bVal.from?.getTime() &&
        aVal.to?.getTime() === bVal.to?.getTime()
      );
    }

    return aVal === bVal;
  });
}

/**
 * Check if current state matches a saved view
 */
export function matchesView(
  viewMode: "table" | "board",
  sortColumn: string | null,
  sortDirection: SortDirection,
  filters: FilterState,
  view: { viewMode: string; sortColumn: string | null; sortDirection: string; filters: FilterState }
): boolean {
  return (
    view.viewMode === viewMode &&
    view.sortColumn === sortColumn &&
    view.sortDirection === sortDirection &&
    filtersEqual(view.filters, filters)
  );
}

/**
 * Apply only filters for columns that exist in the current table
 */
export function getApplicableFilters<T>(
  viewFilters: FilterState,
  columns: ColumnDef<T>[]
): FilterState {
  return Object.entries(viewFilters)
    .filter(([key]) => columns.some((col) => col.id === key))
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
}

// ============================================
// Pagination Utilities
// ============================================

/**
 * Calculate pagination values
 */
export function calculatePagination(
  totalItems: number,
  currentPage: number,
  pageSize: number
): { totalPages: number; startIndex: number; endIndex: number } {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return { totalPages, startIndex, endIndex };
}

/**
 * Get paginated slice of data
 */
export function paginateData<T>(data: T[], currentPage: number, pageSize: number): T[] {
  const { startIndex, endIndex } = calculatePagination(data.length, currentPage, pageSize);
  return data.slice(startIndex, endIndex);
}

// ============================================
// Misc Utilities
// ============================================

/**
 * Group data by a key
 */
export function groupBy<T>(data: T[], key: keyof T | string): Record<string, T[]> {
  return data.reduce((groups, item) => {
    const value = typeof key === "string" && key.includes(".")
      ? getNestedValue(item, key)
      : item[key as keyof T];
    const groupKey = String(value ?? "undefined");
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Format a number for display
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}
