// Main component
export { DataTable } from "./data-table";

// Types
export type {
  ColumnDef,
  FilterState,
  FilterValue,
  FilterOption,
  DateRange,
  ViewData,
  BoardGroupConfig,
  DataTableProps,
  SortDirection,
  SortState,
  PaginationState,
} from "./types";

// Utilities (for custom implementations)
export {
  getNestedValue,
  getColumnValue,
  matchesSearch,
  matchesFilter,
  matchesAllFilters,
  hasActiveFilters,
  getActiveFilterCount,
  sortData,
  groupBy,
  loadPreferences,
  savePreferences,
} from "./utils";

// Hooks (for custom implementations)
export { useDataTableState } from "./hooks";

// Sub-components (for advanced customization)
export { DataTableToolbar } from "./data-table-toolbar";
export { DataTableFilters } from "./data-table-filters";
export { DataTablePagination } from "./data-table-pagination";
export { TableView } from "./table-view";
export { BoardView } from "./board-view";
export { SaveViewDialog, LoadViewDialog } from "./data-table-views";
