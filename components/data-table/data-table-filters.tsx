"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";
import { ColumnDef, FilterState } from "./types";

interface DataTableFiltersProps<T> {
  columns: ColumnDef<T>[];
  filters: FilterState;
  onFilterChange: (columnId: string, value: FilterState[string]) => void;
}

export function DataTableFilters<T>({
  columns,
  filters,
  onFilterChange,
}: DataTableFiltersProps<T>) {
  return (
    <>
      {columns.map((column) => {
        const filterValue = filters[column.id];
        const selectedCount = Array.isArray(filterValue) ? filterValue.length : 0;

        if (column.filterType === "multi-select" && column.filterOptions) {
          return (
            <MultiSelectFilter
              key={column.id}
              column={column}
              value={(filterValue as string[]) || []}
              onChange={(value) => onFilterChange(column.id, value)}
            />
          );
        }

        if (column.filterType === "select" && column.filterOptions) {
          return (
            <SelectFilter
              key={column.id}
              column={column}
              value={(filterValue as string) || ""}
              onChange={(value) => onFilterChange(column.id, value)}
            />
          );
        }

        // Default to multi-select if options are provided
        if (column.filterOptions) {
          return (
            <MultiSelectFilter
              key={column.id}
              column={column}
              value={(filterValue as string[]) || []}
              onChange={(value) => onFilterChange(column.id, value)}
            />
          );
        }

        return null;
      })}
    </>
  );
}

// Multi-select filter component
interface MultiSelectFilterProps<T> {
  column: ColumnDef<T>;
  value: string[];
  onChange: (value: string[]) => void;
}

function MultiSelectFilter<T>({
  column,
  value,
  onChange,
}: MultiSelectFilterProps<T>) {
  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex h-7 items-center gap-1.5 rounded border border-border bg-background px-2.5 text-xs transition-colors hover:bg-background-secondary/50">
          <span>{column.header}</span>
          {value.length > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-primary-600 text-[10px] text-white">
              {value.length}
            </span>
          )}
          <ChevronDown className="size-3 text-text-secondary" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-64 w-56 overflow-y-auto p-2">
        <div className="flex flex-col gap-1">
          {column.filterOptions?.map((option) => {
            const Icon = option.icon;
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-background-secondary/50"
              >
                <Checkbox
                  checked={value.includes(option.value)}
                  onCheckedChange={() => toggleOption(option.value)}
                />
                {Icon && <Icon className="size-3 text-text-secondary" />}
                <span className="truncate text-sm">{option.label}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Single select filter component
interface SelectFilterProps<T> {
  column: ColumnDef<T>;
  value: string;
  onChange: (value: string) => void;
}

function SelectFilter<T>({
  column,
  value,
  onChange,
}: SelectFilterProps<T>) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex h-7 items-center gap-1.5 rounded border border-border bg-background px-2.5 text-xs transition-colors hover:bg-background-secondary/50">
          <span>{column.header}</span>
          {value && (
            <span className="flex size-4 items-center justify-center rounded-full bg-primary-600 text-[10px] text-white">
              1
            </span>
          )}
          <ChevronDown className="size-3 text-text-secondary" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-64 w-56 overflow-y-auto p-2">
        <div className="flex flex-col gap-1">
          <label
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-background-secondary/50"
          >
            <Checkbox
              checked={!value}
              onCheckedChange={() => onChange("")}
            />
            <span className="text-sm text-text-secondary">All</span>
          </label>
          {column.filterOptions?.map((option) => {
            const Icon = option.icon;
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-background-secondary/50"
              >
                <Checkbox
                  checked={value === option.value}
                  onCheckedChange={() => onChange(option.value)}
                />
                {Icon && <Icon className="size-3 text-text-secondary" />}
                <span className="truncate text-sm">{option.label}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
