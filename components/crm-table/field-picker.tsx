"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Calendar, Check, Hash, Tag, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrmColumnDef, CrmColumnType } from "./types";

const TYPE_ICONS: Record<CrmColumnType, typeof Type> = {
  text: Type,
  number: Hash,
  date: Calendar,
  select: Tag,
};

export function getColumnTypeIcon(type: CrmColumnType = "text") {
  return TYPE_ICONS[type];
}

/** Shared styling for the segments inside a filter or sort chip. */
export const CHIP_BUTTON_CLASS =
  "flex h-7 items-center gap-1.5 px-2 text-xs text-text transition-colors hover:bg-background-secondary";

/** Shared styling for the dashed "add" buttons in the toolbar. */
export const CHIP_ADD_CLASS =
  "flex h-7 items-center gap-1 rounded border border-dashed border-border px-2 text-xs text-text-secondary transition-colors hover:bg-background-secondary";

interface FieldPickerProps<T> {
  columns: CrmColumnDef<T>[];
  onSelect: (column: CrmColumnDef<T>) => void;
  trigger: React.ReactNode;
  placeholder?: string;
  /** Marks the current choice with a tick, for pickers that change a value. */
  selectedId?: string | null;
}

/** Searchable column list, shared by the filter builder and the sort picker. */
export function FieldPicker<T>({
  columns,
  onSelect,
  trigger,
  placeholder = "Find a field...",
  selectedId,
}: FieldPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = columns.filter((column) =>
    column.header.toLowerCase().includes(query.toLowerCase())
  );

  // Sections only appear once columns opt into a group, so the CRM tables keep
  // their flat list while richer field sets can be organised.
  const sections = matches.reduce<Array<[string, CrmColumnDef<T>[]]>>(
    (groups, column) => {
      const name = column.group ?? "";
      const existing = groups.find(([groupName]) => groupName === name);
      if (existing) existing[1].push(column);
      else groups.push([name, [column]]);
      return groups;
    },
    []
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="mb-1 h-8 text-sm"
        />
        <div className="flex max-h-64 flex-col overflow-y-auto">
          {matches.length === 0 && (
            <p className="px-2 py-3 text-center text-sm text-text-secondary">
              No fields match
            </p>
          )}
          {sections.map(([name, sectionColumns]) => (
            <div key={name || "default"} className="flex flex-col">
              {name && (
                <span className="px-2 pb-0.5 pt-2 text-xs font-medium text-text-tertiary">
                  {name}
                </span>
              )}
              {sectionColumns.map((column) => {
                const Icon = TYPE_ICONS[column.type ?? "text"];
                const isSelected = selectedId === column.id;

                return (
                  <button
                    key={column.id}
                    type="button"
                    onClick={() => {
                      onSelect(column);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-background-secondary",
                      isSelected && "bg-background-secondary"
                    )}
                  >
                    <Icon className="size-3 shrink-0 text-text-tertiary" />
                    <span className="flex-1 truncate">{column.header}</span>
                    {isSelected && <Check className="size-3 shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
