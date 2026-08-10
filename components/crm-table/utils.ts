import type {
  CrmColumnDef,
  CrmColumnType,
  CrmFilterCombinator,
  CrmFilterCondition,
  CrmFilterGroup,
  CrmFilterNode,
  CrmFilterOperator,
  CrmSortDirection,
  CrmTableStoredPreferences,
} from "./types";

const DAY_MS = 86_400_000;

// ============================================
// Value access
// ============================================

function getNestedValue<T>(row: T, path: string): unknown {
  return path.split(".").reduce((acc: unknown, part: string) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, row);
}

export function getColumnValue<T>(row: T, column: CrmColumnDef<T>): unknown {
  if (column.accessorFn) return column.accessorFn(row);
  if (column.accessorKey) {
    const key = column.accessorKey;
    if (typeof key === "string" && key.includes(".")) {
      return getNestedValue(row, key);
    }
    return row[key as keyof T];
  }
  return undefined;
}

/** The value filters and sorts compare against. */
export function getComparableValue<T>(row: T, column: CrmColumnDef<T>): unknown {
  return column.filterValueFn
    ? column.filterValueFn(row)
    : getColumnValue(row, column);
}

// ============================================
// Formatting
// ============================================

const RELATIVE_UNITS: Array<{ limit: number; ms: number; name: string }> = [
  { limit: 60_000, ms: 1_000, name: "second" },
  { limit: 3_600_000, ms: 60_000, name: "minute" },
  { limit: DAY_MS, ms: 3_600_000, name: "hour" },
  { limit: 30 * DAY_MS, ms: DAY_MS, name: "day" },
  { limit: 365 * DAY_MS, ms: 30 * DAY_MS, name: "month" },
  { limit: Infinity, ms: 365 * DAY_MS, name: "year" },
];

/**
 * Human distance from now, in the style the CRM uses elsewhere:
 * "about 1 hour ago", "5 months ago", "in 2 days".
 */
export function formatRelativeTime(
  value: Date | string | number,
  now: Date = new Date()
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diff = date.getTime() - now.getTime();
  const absolute = Math.abs(diff);

  if (absolute < 45_000) return "just now";

  const unit =
    RELATIVE_UNITS.find((candidate) => absolute < candidate.limit) ??
    RELATIVE_UNITS[RELATIVE_UNITS.length - 1];

  const amount = Math.max(1, Math.round(absolute / unit.ms));
  const plural = amount === 1 ? unit.name : `${unit.name}s`;
  // "about" only reads well on the coarser units, matching how Attio phrases it
  const hedge = unit.name === "hour" || unit.name === "minute" ? "about " : "";

  return diff >= 0 ? `in ${amount} ${plural}` : `${hedge}${amount} ${plural} ago`;
}

export function formatAbsoluteDate(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const weekday = date.toLocaleDateString("en-GB", { weekday: "short" });
  const day = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "short" });
  const year = date.getFullYear();
  return `${weekday} ${day} ${month} ${year}`;
}

// ============================================
// Operators
// ============================================

const OPERATORS_BY_TYPE: Record<CrmColumnType, CrmFilterOperator[]> = {
  text: ["contains", "not_contains", "is", "is_not", "is_empty", "is_not_empty"],
  select: ["is_any_of", "is_none_of", "is_empty", "is_not_empty"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"],
  date: [
    "on",
    "before",
    "after",
    "between",
    "in_last_days",
    "in_next_days",
    "is_empty",
    "is_not_empty",
  ],
};

export const OPERATOR_LABELS: Record<CrmFilterOperator, string> = {
  contains: "contains",
  not_contains: "does not contain",
  is: "is",
  is_not: "is not",
  is_any_of: "is any of",
  is_none_of: "is none of",
  eq: "=",
  neq: "≠",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  on: "is",
  before: "is before",
  after: "is after",
  between: "is between",
  in_last_days: "in the last",
  in_next_days: "in the next",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

export function getOperatorsForType(
  type: CrmColumnType = "text"
): CrmFilterOperator[] {
  return OPERATORS_BY_TYPE[type];
}

export function operatorNeedsValue(operator: CrmFilterOperator): boolean {
  return operator !== "is_empty" && operator !== "is_not_empty";
}

// ============================================
// Filtering
// ============================================

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** A condition with no value yet is treated as inactive rather than as a filter. */
export function isConditionActive(condition: CrmFilterCondition): boolean {
  if (!operatorNeedsValue(condition.operator)) return true;
  if (condition.operator === "between") {
    return Boolean(condition.value) && Boolean(condition.value2);
  }
  return !isEmptyValue(condition.value);
}

function matchesTextCondition(
  cell: unknown,
  condition: CrmFilterCondition
): boolean {
  const haystack = String(cell ?? "").toLowerCase();
  const needle = String(condition.value ?? "").toLowerCase();

  switch (condition.operator) {
    case "contains":
      return haystack.includes(needle);
    case "not_contains":
      return !haystack.includes(needle);
    case "is":
      return haystack === needle;
    case "is_not":
      return haystack !== needle;
    default:
      return true;
  }
}

function matchesSelectCondition(
  cell: unknown,
  condition: CrmFilterCondition
): boolean {
  const selected = Array.isArray(condition.value)
    ? condition.value
    : [String(condition.value ?? "")];

  // Multi-valued cells match when any of their values was selected
  const cellValues = Array.isArray(cell)
    ? cell.map((entry) => String(entry))
    : [cell === null || cell === undefined ? "" : String(cell)];

  const hit = cellValues.some((value) => selected.includes(value));

  return condition.operator === "is_any_of" ? hit : !hit;
}

function matchesNumberCondition(
  cell: unknown,
  condition: CrmFilterCondition
): boolean {
  const cellNumber = typeof cell === "number" ? cell : Number(cell);
  const target = Number(condition.value);
  if (Number.isNaN(cellNumber) || Number.isNaN(target)) return false;

  switch (condition.operator) {
    case "eq":
      return cellNumber === target;
    case "neq":
      return cellNumber !== target;
    case "gt":
      return cellNumber > target;
    case "gte":
      return cellNumber >= target;
    case "lt":
      return cellNumber < target;
    case "lte":
      return cellNumber <= target;
    default:
      return true;
  }
}

function matchesDateCondition(
  cell: unknown,
  condition: CrmFilterCondition,
  now: Date
): boolean {
  const date = toDate(cell);
  if (!date) return false;

  switch (condition.operator) {
    case "on": {
      const target = toDate(condition.value);
      if (!target) return true;
      return startOfDay(date).getTime() === startOfDay(target).getTime();
    }
    case "before": {
      const target = toDate(condition.value);
      return target ? date.getTime() < startOfDay(target).getTime() : true;
    }
    case "after": {
      const target = toDate(condition.value);
      return target
        ? date.getTime() >= startOfDay(target).getTime() + DAY_MS
        : true;
    }
    case "between": {
      const from = toDate(condition.value);
      const to = toDate(condition.value2 ?? null);
      if (!from || !to) return true;
      return (
        date.getTime() >= startOfDay(from).getTime() &&
        date.getTime() < startOfDay(to).getTime() + DAY_MS
      );
    }
    case "in_last_days": {
      const days = Number(condition.value);
      if (Number.isNaN(days)) return true;
      return (
        date.getTime() <= now.getTime() &&
        date.getTime() >= now.getTime() - days * DAY_MS
      );
    }
    case "in_next_days": {
      const days = Number(condition.value);
      if (Number.isNaN(days)) return true;
      return (
        date.getTime() >= now.getTime() &&
        date.getTime() <= now.getTime() + days * DAY_MS
      );
    }
    default:
      return true;
  }
}

export function matchesCondition<T>(
  row: T,
  column: CrmColumnDef<T>,
  condition: CrmFilterCondition,
  now: Date
): boolean {
  const cell = getComparableValue(row, column);

  if (condition.operator === "is_empty") return isEmptyValue(cell);
  if (condition.operator === "is_not_empty") return !isEmptyValue(cell);

  switch (column.type ?? "text") {
    case "select":
      return matchesSelectCondition(cell, condition);
    case "number":
      return matchesNumberCondition(cell, condition);
    case "date":
      return matchesDateCondition(cell, condition, now);
    default:
      return matchesTextCondition(cell, condition);
  }
}

// ============================================
// Filter groups
// ============================================

export function isFilterGroup(node: CrmFilterNode): node is CrmFilterGroup {
  return "combinator" in node;
}

export function createFilterGroup(
  combinator: CrmFilterCombinator = "and",
  children: CrmFilterNode[] = []
): CrmFilterGroup {
  return { id: createConditionId(), combinator, children };
}

/**
 * Accepts anything that may have been persisted as a filter: a group, the flat
 * condition array earlier versions stored, or nothing at all. Unknown shapes
 * degrade to an empty group rather than throwing, because a bad value in
 * localStorage or a JSON column must not take a page down.
 */
export function normaliseFilterGroup(value: unknown): CrmFilterGroup {
  if (Array.isArray(value)) {
    return createFilterGroup("and", value.filter(isConditionLike));
  }

  if (!value || typeof value !== "object") return createFilterGroup();

  const candidate = value as Partial<CrmFilterGroup>;
  if (!Array.isArray(candidate.children)) return createFilterGroup();

  return {
    id: typeof candidate.id === "string" ? candidate.id : createConditionId(),
    combinator: candidate.combinator === "or" ? "or" : "and",
    children: candidate.children.reduce<CrmFilterNode[]>((nodes, child) => {
      if (!child || typeof child !== "object") return nodes;
      const childCandidate = child as Partial<CrmFilterGroup>;
      if (childCandidate.combinator || Array.isArray(childCandidate.children)) {
        nodes.push(normaliseFilterGroup(child));
      } else if (isConditionLike(child)) {
        nodes.push(child);
      }
      return nodes;
    }, []),
  };
}

function isConditionLike(value: unknown): value is CrmFilterCondition {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CrmFilterCondition>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.columnId === "string" &&
    typeof candidate.operator === "string"
  );
}

/** Conditions that would actually narrow the result set. */
export function countActiveConditions(group: CrmFilterGroup): number {
  return group.children.reduce((total, child) => {
    if (isFilterGroup(child)) return total + countActiveConditions(child);
    return total + (isConditionActive(child) ? 1 : 0);
  }, 0);
}

/**
 * Evaluates a group against a row. A group with nothing active in it matches
 * everything, so a half-built filter never blanks the table.
 */
export function matchesFilterGroup<T>(
  row: T,
  columns: CrmColumnDef<T>[],
  group: CrmFilterGroup,
  now: Date
): boolean {
  const results: boolean[] = [];

  for (const child of group.children) {
    if (isFilterGroup(child)) {
      if (countActiveConditions(child) === 0) continue;
      results.push(matchesFilterGroup(row, columns, child, now));
      continue;
    }

    if (!isConditionActive(child)) continue;
    const column = columns.find((entry) => entry.id === child.columnId);
    if (!column) continue;
    results.push(matchesCondition(row, column, child, now));
  }

  if (results.length === 0) return true;

  return group.combinator === "or"
    ? results.some(Boolean)
    : results.every(Boolean);
}

// ============================================
// Sorting
// ============================================

export function sortRows<T>(
  rows: T[],
  column: CrmColumnDef<T> | undefined,
  direction: CrmSortDirection
): T[] {
  if (!column) return rows;

  return [...rows].sort((a, b) => {
    if (column.sortFn) return column.sortFn(a, b, direction);

    // The displayed value, not filterValueFn: filters compare against ids
    // (owner id, company id) which carry no meaningful order.
    const aValue = getColumnValue(a, column);
    const bValue = getColumnValue(b, column);

    // Blanks always sink to the bottom, whichever way the column is sorted
    if (isEmptyValue(aValue)) return isEmptyValue(bValue) ? 0 : 1;
    if (isEmptyValue(bValue)) return -1;

    let comparison: number;
    if (aValue instanceof Date && bValue instanceof Date) {
      comparison = aValue.getTime() - bValue.getTime();
    } else if (typeof aValue === "number" && typeof bValue === "number") {
      comparison = aValue - bValue;
    } else {
      comparison = String(aValue).localeCompare(String(bValue));
    }

    return direction === "asc" ? comparison : -comparison;
  });
}

// ============================================
// Sizing
// ============================================

const DEFAULT_WIDTHS: Record<CrmColumnType, number> = {
  text: 180,
  number: 110,
  date: 160,
  select: 150,
};

export const MIN_COLUMN_WIDTH = 80;

export function getColumnWidth<T>(
  column: CrmColumnDef<T>,
  overrides: Record<string, number>
): number {
  const width =
    overrides[column.id] ??
    column.width ??
    DEFAULT_WIDTHS[column.type ?? "text"];
  return Math.max(column.minWidth ?? MIN_COLUMN_WIDTH, width);
}

// ============================================
// Persistence
// ============================================

const STORAGE_PREFIX = "crm-table-";

export function loadCrmTablePreferences(
  storageKey: string
): Partial<CrmTableStoredPreferences> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveCrmTablePreferences(
  storageKey: string,
  preferences: CrmTableStoredPreferences
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${storageKey}`,
      JSON.stringify(preferences)
    );
  } catch {
    // Storage can be full or blocked; preferences are not worth failing over
  }
}

export function createConditionId(): string {
  return Math.random().toString(36).slice(2, 10);
}
