import { LucideIcon } from "lucide-react";

// ============================================
// Filter Types
// ============================================

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export type FilterValue = string | string[] | DateRange | null;

export interface FilterState {
  [columnId: string]: FilterValue;
}

export interface FilterOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  color?: string;
}

// ============================================
// Column Definition
// ============================================

export interface ColumnDef<T> {
  /** Unique identifier for the column */
  id: string;
  
  /** Header text displayed in the table */
  header: string;
  
  /** Key to access data or function to extract value */
  accessorKey?: keyof T | string;
  accessorFn?: (row: T) => unknown;
  
  /** Custom cell renderer */
  cell?: (row: T) => React.ReactNode;
  
  // Sorting
  /** Enable sorting for this column */
  sortable?: boolean;
  /** Custom sort function */
  sortFn?: (a: T, b: T, direction: "asc" | "desc") => number;
  
  // Filtering
  /** Enable filtering for this column */
  filterable?: boolean;
  /** Type of filter UI to show */
  filterType?: "select" | "multi-select" | "date-range" | "text";
  /** Options for select/multi-select filters */
  filterOptions?: FilterOption[];
  /** Custom filter function */
  filterFn?: (row: T, filterValue: FilterValue) => boolean;
  
  // Sizing
  /** Width class (e.g., "w-40", "w-2/5") */
  width?: string;
  /** Minimum width class */
  minWidth?: string;
  
  // Board view
  /** Whether to show this column in board view cards */
  showInBoard?: boolean;
  /** Custom board card renderer for this column */
  boardCell?: (row: T) => React.ReactNode;
}

// ============================================
// View Data
// ============================================

export interface ViewData {
  id: string;
  name: string;
  viewMode: "table" | "board";
  sortColumn: string | null;
  sortDirection: "asc" | "desc";
  filters: FilterState;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// Board View Configuration
// ============================================

export interface BoardGroupConfig {
  label: string;
  icon?: LucideIcon;
  color?: string;
}

// ============================================
// Pagination
// ============================================

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// ============================================
// Sort State
// ============================================

export type SortDirection = "asc" | "desc";

export interface SortState {
  column: string | null;
  direction: SortDirection;
}

// ============================================
// Main DataTable Props
// ============================================

export interface DataTableProps<T> {
  /** Data array to display */
  data: T[];
  
  /** Column definitions */
  columns: ColumnDef<T>[];
  
  /** Unique key for localStorage persistence */
  storageKey: string;
  
  // Search
  /** Enable search functionality */
  searchable?: boolean;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Keys to search in (supports nested keys like "company.name") */
  searchKeys?: string[];
  /** Custom search function (overrides searchKeys) */
  searchFn?: (row: T, query: string) => boolean;
  
  // Views
  /** Enable board/kanban view */
  enableBoardView?: boolean;
  /** Key to group items by in board view */
  boardGroupBy?: keyof T | string;
  /** Configuration for board groups (labels, icons, colors) */
  boardGroupConfig?: Record<string, BoardGroupConfig>;
  /** Order of board columns */
  boardGroupOrder?: string[];
  /** Custom board card renderer */
  renderBoardCard?: (row: T) => React.ReactNode;
  
  // Saved views (external management)
  /** Saved views passed from parent */
  savedViews?: ViewData[];
  /** Callback when saving a new view */
  onSaveView?: (view: Omit<ViewData, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  /** Callback when updating a view */
  onUpdateView?: (id: string, data: Partial<ViewData>) => Promise<void>;
  /** Callback when deleting a view */
  onDeleteView?: (id: string) => Promise<void>;
  
  // Default filters
  /** Default filter values (used when no stored preferences exist) */
  defaultFilters?: FilterState;
  
  // URL filters
  /** URL-driven filter values (takes priority over localStorage and defaultFilters) */
  urlFilters?: FilterState;
  
  // Default sort
  /** Default sort (used when no stored preferences exist) */
  defaultSort?: SortState;
  
  // Pagination
  /** Initial page size (default: 25) */
  pageSize?: number;
  /** Available page size options */
  pageSizeOptions?: number[];
  /** Disable pagination */
  disablePagination?: boolean;
  
  // Row interaction
  /** Get unique ID for a row */
  getRowId: (row: T) => string;
  /** Callback when row is clicked */
  onRowClick?: (row: T) => void;
  
  // Highlighting (for navigation)
  /** IDs of rows to highlight */
  highlightIds?: string[];
  /** Callback to clear highlights */
  onHighlightClear?: () => void;
  
  // Actions
  /** Render actions column content */
  renderActions?: (row: T) => React.ReactNode;
  /** Header actions (e.g., "New Task" button) */
  headerActions?: React.ReactNode;
  
  // Empty state
  /** Message or element when no data */
  emptyMessage?: React.ReactNode;
  /** Message or element when filters return no results */
  emptyFilteredMessage?: React.ReactNode;
  
  // Styling
  /** Additional class for the container */
  className?: string;
  /** Whether rows are clickable (adds hover styles) */
  clickableRows?: boolean;
}

// ============================================
// Internal State Types
// ============================================

export interface DataTableState {
  viewMode: "table" | "board";
  searchQuery: string;
  filters: FilterState;
  sort: SortState;
  pagination: PaginationState;
}

export interface StoredPreferences {
  viewMode: "table" | "board";
  sortColumn: string | null;
  sortDirection: SortDirection;
  filters: FilterState;
  pageSize: number;
}
