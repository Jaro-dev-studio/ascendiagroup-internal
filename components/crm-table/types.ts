import type { LucideIcon } from "lucide-react";

/**
 * Column value type. Drives the header glyph, the operators the filter builder
 * offers, and how values are compared when sorting and filtering.
 */
export type CrmColumnType = "text" | "number" | "date" | "select";

export type CrmFilterOperator =
  // text
  | "contains"
  | "not_contains"
  | "is"
  | "is_not"
  // select
  | "is_any_of"
  | "is_none_of"
  // number
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  // date
  | "on"
  | "before"
  | "after"
  | "between"
  | "in_last_days"
  | "in_next_days"
  // any
  | "is_empty"
  | "is_not_empty";

export interface CrmFilterOption {
  value: string;
  label: string;
  icon?: LucideIcon;
}

/**
 * One row of the filter builder. Values are kept as strings (ISO dates, numbers
 * as text) so a condition survives a localStorage or JSON column round trip
 * unchanged.
 */
export interface CrmFilterCondition {
  id: string;
  columnId: string;
  operator: CrmFilterOperator;
  value: string | string[] | null;
  /** Upper bound, used only by "between". */
  value2?: string | null;
}

export type CrmFilterCombinator = "and" | "or";

/**
 * A set of conditions and nested groups joined by one combinator. Nesting is
 * what allows "stage is Lead AND (industry is SaaS OR employees > 200)".
 */
export interface CrmFilterGroup {
  id: string;
  combinator: CrmFilterCombinator;
  children: CrmFilterNode[];
}

export type CrmFilterNode = CrmFilterCondition | CrmFilterGroup;

export type CrmSortDirection = "asc" | "desc";

export interface CrmSortState {
  column: string | null;
  direction: CrmSortDirection;
}

export interface CrmColumnDef<T> {
  id: string;
  header: string;
  /** Defaults to "text". */
  type?: CrmColumnType;
  /** Section heading in the field picker, e.g. "Company". Optional. */
  group?: string;

  accessorKey?: keyof T | string;
  accessorFn?: (row: T) => unknown;

  /** Custom cell renderer. Falls back to a formatted accessor value. */
  cell?: (row: T) => React.ReactNode;

  sortable?: boolean;
  sortFn?: (a: T, b: T, direction: CrmSortDirection) => number;

  filterable?: boolean;
  /** Options for "select" columns. */
  filterOptions?: CrmFilterOption[];
  /**
   * Narrows the operators offered, for columns where the defaults for their
   * type do not all apply (e.g. a value that can never be empty).
   */
  operators?: CrmFilterOperator[];
  /**
   * Value the filter and sort compare against, when it differs from what the
   * cell displays (e.g. a company id behind a company name).
   */
  filterValueFn?: (row: T) => string | string[] | number | Date | null;

  /** Rendered width in pixels. Resizable at runtime. */
  width?: number;
  minWidth?: number;

  /** Frozen to the left edge. Pinned columns must come first in the array. */
  pinned?: boolean;

  showInBoard?: boolean;
  boardCell?: (row: T) => React.ReactNode;
}

export interface CrmTableProps<T> {
  data: T[];
  columns: CrmColumnDef<T>[];
  /** Namespace for persisted sort, filters and column widths. */
  storageKey: string;

  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;

  searchable?: boolean;
  searchPlaceholder?: string;
  searchFn?: (row: T, query: string) => boolean;

  defaultSort?: CrmSortState;

  pageSize?: number;
  pageSizeOptions?: number[];

  /** Buttons rendered at the right of the toolbar. */
  headerActions?: React.ReactNode;
  /** Per-row trailing actions, rendered in a final unpinned column. */
  renderActions?: (row: T) => React.ReactNode;

  /** Noun used in the footer count and empty states, e.g. "person". */
  rowLabel?: string;
  emptyMessage?: React.ReactNode;
  emptyFilteredMessage?: React.ReactNode;

  /** Board view is delegated to the existing DataTable board renderer. */
  enableBoardView?: boolean;
  renderBoardView?: () => React.ReactNode;

  /** Adds a pinned checkbox column and a selection summary in the footer. */
  enableRowSelection?: boolean;
  renderBulkActions?: (selectedRows: T[]) => React.ReactNode;

  className?: string;
}

export interface CrmTableStoredPreferences {
  viewMode: "table" | "board";
  sortColumn: string | null;
  sortDirection: CrmSortDirection;
  filters: CrmFilterGroup;
  /** Flat AND list written by earlier versions, migrated on read. */
  conditions?: CrmFilterCondition[];
  columnWidths: Record<string, number>;
  pageSize: number;
}
