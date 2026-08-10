"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react";
import {
  CHIP_ADD_CLASS,
  CHIP_BUTTON_CLASS,
  FieldPicker,
  getColumnTypeIcon,
} from "./field-picker";
import type { CrmColumnDef, CrmSortState } from "./types";

interface CrmSortPickerProps<T> {
  columns: CrmColumnDef<T>[];
  sort: CrmSortState;
  onChange: (sort: CrmSortState) => void;
}

/**
 * Toolbar control for choosing the sort column and direction, so sorting does
 * not depend on knowing that column headers are clickable.
 */
export function CrmSortPicker<T>({
  columns,
  sort,
  onChange,
}: CrmSortPickerProps<T>) {
  const sortableColumns = columns.filter((column) => column.sortable);
  if (sortableColumns.length === 0) return null;

  const active =
    sortableColumns.find((column) => column.id === sort.column) ?? null;

  if (!active) {
    return (
      <FieldPicker
        columns={sortableColumns}
        placeholder="Sort by..."
        onSelect={(column) =>
          onChange({ column: column.id, direction: "asc" })
        }
        trigger={
          <button type="button" className={CHIP_ADD_CLASS}>
            <ArrowUpDown className="size-3" />
            <span>Sort</span>
          </button>
        }
      />
    );
  }

  const FieldIcon = getColumnTypeIcon(active.type);
  const DirectionIcon = sort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className="flex items-center divide-x divide-border overflow-hidden rounded border border-border bg-background">
      <FieldPicker
        columns={sortableColumns}
        placeholder="Sort by..."
        selectedId={active.id}
        onSelect={(column) =>
          onChange({ column: column.id, direction: sort.direction })
        }
        trigger={
          <button type="button" className={CHIP_BUTTON_CLASS}>
            <FieldIcon className="size-3 text-text-tertiary" />
            <span>Sorted by {active.header}</span>
          </button>
        }
      />

      <button
        type="button"
        onClick={() =>
          onChange({
            column: active.id,
            direction: sort.direction === "asc" ? "desc" : "asc",
          })
        }
        className={CHIP_BUTTON_CLASS}
      >
        <DirectionIcon className="size-3 text-text-tertiary" />
        <span>{sort.direction === "asc" ? "Ascending" : "Descending"}</span>
      </button>

      <button
        type="button"
        aria-label="Clear sort"
        onClick={() => onChange({ column: null, direction: "asc" })}
        className="flex h-7 items-center px-1.5 text-text-tertiary transition-colors hover:bg-background-secondary hover:text-text"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
