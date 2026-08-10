"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ColumnDef,
  FilterState,
  SortState,
  StoredPreferences,
  ViewData,
  SortDirection,
} from "../types";
import {
  loadPreferences,
  savePreferences,
  matchesSearch,
  matchesAllFilters,
  sortData,
  paginateData,
  getApplicableFilters,
  matchesView,
} from "../utils";

interface UseDataTableStateOptions<T> {
  data: T[];
  columns: ColumnDef<T>[];
  storageKey: string;
  
  // Search
  searchKeys?: string[];
  searchFn?: (row: T, query: string) => boolean;
  
  // Pagination
  initialPageSize?: number;
  disablePagination?: boolean;
  
  // Board view
  enableBoardView?: boolean;
  
  // Saved views
  savedViews?: ViewData[];
  
  // Default filters (used when no stored preferences)
  defaultFilters?: FilterState;
  
  // Default sort (used when no stored preferences)
  defaultSort?: SortState;
  
  // URL filters (takes priority over localStorage and defaultFilters)
  urlFilters?: FilterState;
}

interface UseDataTableStateReturn<T> {
  // View mode
  viewMode: "table" | "board";
  setViewMode: (mode: "table" | "board") => void;
  
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // Filters
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  setFilter: (columnId: string, value: FilterState[string]) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  
  // Sort
  sort: SortState;
  setSort: (sort: SortState) => void;
  toggleSort: (columnId: string) => void;
  
  // Pagination
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalPages: number;
  totalItems: number;
  
  // Processed data
  filteredData: T[];
  sortedData: T[];
  paginatedData: T[];
  
  // Views
  currentViewMatch: ViewData | undefined;
  loadView: (view: ViewData) => void;
  getCurrentViewState: () => Omit<ViewData, "id" | "createdAt" | "updatedAt">;
}

export function useDataTableState<T>(
  options: UseDataTableStateOptions<T>
): UseDataTableStateReturn<T> {
  const {
    data,
    columns,
    storageKey,
    searchKeys,
    searchFn,
    initialPageSize = 25,
    disablePagination = false,
    enableBoardView = false,
    savedViews = [],
    defaultFilters = {},
    defaultSort,
    urlFilters,
  } = options;

  // Load initial preferences from localStorage
  const initialPrefs = useMemo(() => loadPreferences(storageKey), [storageKey]);

  // View mode state
  const [viewMode, setViewModeState] = useState<"table" | "board">(() => {
    if (!enableBoardView) return "table";
    return initialPrefs.viewMode ?? "table";
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Filter state (URL filters take priority, then stored preferences, then defaultFilters)
  const [filters, setFiltersState] = useState<FilterState>(() => {
    // URL filters take highest priority (for direct links like /dashboard/tasks?status=BLOCKED)
    if (urlFilters && Object.keys(urlFilters).length > 0) {
      return urlFilters;
    }
    // Then use stored filters if they exist
    if (initialPrefs.filters && Object.keys(initialPrefs.filters).length > 0) {
      return initialPrefs.filters;
    }
    return defaultFilters;
  });

  // Sort state (use stored preferences if available, otherwise use defaultSort)
  const [sort, setSortState] = useState<SortState>(() => {
    // If there's a stored sort preference, use it
    if (initialPrefs.sortColumn) {
      return {
        column: initialPrefs.sortColumn,
        direction: initialPrefs.sortDirection ?? "asc",
      };
    }
    // Otherwise, use defaultSort if provided
    if (defaultSort) {
      return defaultSort;
    }
    // Fall back to no sorting
    return { column: null, direction: "asc" };
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(() => {
    return initialPrefs.pageSize ?? initialPageSize;
  });

  // Persist preferences to localStorage
  useEffect(() => {
    const prefs: StoredPreferences = {
      viewMode,
      sortColumn: sort.column,
      sortDirection: sort.direction,
      filters,
      pageSize,
    };
    savePreferences(storageKey, prefs);
  }, [viewMode, sort, filters, pageSize, storageKey]);

  // Reset to page 1 when filters, search, or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, sort]);

  // Filter data
  const filteredData = useMemo(() => {
    return data.filter((row) => {
      const matchSearch = matchesSearch(row, searchQuery, searchKeys, searchFn);
      const matchFilters = matchesAllFilters(row, columns, filters);
      return matchSearch && matchFilters;
    });
  }, [data, searchQuery, searchKeys, searchFn, columns, filters]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sort.column) return filteredData;
    const column = columns.find((c) => c.id === sort.column);
    return sortData(filteredData, column, sort.direction);
  }, [filteredData, sort, columns]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (disablePagination) return sortedData;
    return paginateData(sortedData, currentPage, pageSize);
  }, [sortedData, currentPage, pageSize, disablePagination]);

  // Total pages calculation
  const totalPages = useMemo(() => {
    if (disablePagination) return 1;
    return Math.max(1, Math.ceil(sortedData.length / pageSize));
  }, [sortedData.length, pageSize, disablePagination]);

  // Active filters check
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some((value) => {
      if (value === null || value === undefined) return false;
      if (typeof value === "string") return value !== "";
      if (Array.isArray(value)) return value.length > 0;
      return false;
    });
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter((value) => {
      if (value === null || value === undefined) return false;
      if (typeof value === "string") return value !== "";
      if (Array.isArray(value)) return value.length > 0;
      return false;
    }).length;
  }, [filters]);

  // View mode setter with board view check
  const setViewMode = useCallback(
    (mode: "table" | "board") => {
      if (mode === "board" && !enableBoardView) return;
      setViewModeState(mode);
    },
    [enableBoardView]
  );

  // Filter setters
  const setFilters = useCallback((newFilters: FilterState) => {
    setFiltersState(newFilters);
  }, []);

  const setFilter = useCallback((columnId: string, value: FilterState[string]) => {
    setFiltersState((prev) => ({
      ...prev,
      [columnId]: value,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({});
  }, []);

  // Sort setter
  const setSort = useCallback((newSort: SortState) => {
    setSortState(newSort);
  }, []);

  // Toggle sort (cycles: asc -> desc -> none)
  const toggleSort = useCallback((columnId: string) => {
    setSortState((prev) => {
      if (prev.column !== columnId) {
        return { column: columnId, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { column: columnId, direction: "desc" };
      }
      return { column: null, direction: "asc" };
    });
  }, []);

  // Page size setter
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setCurrentPage(1);
  }, []);

  // Check if current state matches a saved view
  const currentViewMatch = useMemo(() => {
    return savedViews.find((view) =>
      matchesView(viewMode, sort.column, sort.direction, filters, view)
    );
  }, [savedViews, viewMode, sort, filters]);

  // Load a saved view
  const loadView = useCallback(
    (view: ViewData) => {
      if (view.viewMode === "board" && enableBoardView) {
        setViewModeState("board");
      } else {
        setViewModeState("table");
      }
      setSortState({
        column: view.sortColumn,
        direction: view.sortDirection as SortDirection,
      });
      // Only apply filters for columns that exist
      const applicableFilters = getApplicableFilters(view.filters, columns);
      setFiltersState(applicableFilters);
    },
    [columns, enableBoardView]
  );

  // Get current view state for saving
  const getCurrentViewState = useCallback(
    (): Omit<ViewData, "id" | "createdAt" | "updatedAt"> => ({
      name: "",
      viewMode,
      sortColumn: sort.column,
      sortDirection: sort.direction,
      filters,
    }),
    [viewMode, sort, filters]
  );

  return {
    // View mode
    viewMode,
    setViewMode,
    
    // Search
    searchQuery,
    setSearchQuery,
    
    // Filters
    filters,
    setFilters,
    setFilter,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    
    // Sort
    sort,
    setSort,
    toggleSort,
    
    // Pagination
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems: sortedData.length,
    
    // Processed data
    filteredData,
    sortedData,
    paginatedData,
    
    // Views
    currentViewMatch,
    loadView,
    getCurrentViewState,
  };
}
