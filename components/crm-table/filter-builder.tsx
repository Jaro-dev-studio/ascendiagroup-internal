"use client";

import { Fragment, useMemo } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Parentheses, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CHIP_ADD_CLASS,
  CHIP_BUTTON_CLASS,
  FieldPicker,
  getColumnTypeIcon,
} from "./field-picker";
import type {
  CrmColumnDef,
  CrmColumnType,
  CrmFilterCondition,
  CrmFilterGroup,
  CrmFilterNode,
  CrmFilterOperator,
} from "./types";
import {
  OPERATOR_LABELS,
  createConditionId,
  createFilterGroup,
  getOperatorsForType,
  isFilterGroup,
  operatorNeedsValue,
} from "./utils";

/** Nesting past this reads as noise, so the "add group" affordance stops here. */
const DEFAULT_MAX_DEPTH = 4;

function columnOperators<T>(column: CrmColumnDef<T>): CrmFilterOperator[] {
  return column.operators ?? getOperatorsForType(column.type ?? "text");
}

interface CrmFilterBuilderProps<T> {
  columns: CrmColumnDef<T>[];
  filters: CrmFilterGroup;
  onChange: (filters: CrmFilterGroup) => void;
  maxDepth?: number;
}

/**
 * Builds an arbitrarily nested AND/OR tree of conditions. Each group renders as
 * a row of chips joined by a combinator the user can flip, and any group can
 * hold further groups, which is what makes bracketed logic expressible.
 */
export function CrmFilterBuilder<T>({
  columns,
  filters,
  onChange,
  maxDepth = DEFAULT_MAX_DEPTH,
}: CrmFilterBuilderProps<T>) {
  const filterableColumns = useMemo(
    () => columns.filter((column) => column.filterable),
    [columns]
  );

  if (filterableColumns.length === 0) return null;

  return (
    <GroupEditor
      columns={filterableColumns}
      group={filters}
      onChange={onChange}
      depth={0}
      maxDepth={maxDepth}
    />
  );
}

interface GroupEditorProps<T> {
  columns: CrmColumnDef<T>[];
  group: CrmFilterGroup;
  onChange: (group: CrmFilterGroup) => void;
  onRemove?: () => void;
  depth: number;
  maxDepth: number;
}

function GroupEditor<T>({
  columns,
  group,
  onChange,
  onRemove,
  depth,
  maxDepth,
}: GroupEditorProps<T>) {
  const setChildren = (children: CrmFilterNode[]) =>
    onChange({ ...group, children });

  const addCondition = (column: CrmColumnDef<T>) => {
    const [firstOperator] = columnOperators(column);
    setChildren([
      ...group.children,
      {
        id: createConditionId(),
        columnId: column.id,
        operator: firstOperator,
        value: column.type === "select" ? [] : "",
      },
    ]);
  };

  const addGroup = () => {
    // Nested groups default to the opposite combinator, which is almost always
    // what someone reaching for a group wanted.
    setChildren([
      ...group.children,
      createFilterGroup(group.combinator === "and" ? "or" : "and"),
    ]);
  };

  const replaceChild = (id: string, child: CrmFilterNode) => {
    setChildren(
      group.children.map((entry) => (entry.id === id ? child : entry))
    );
  };

  const removeChild = (id: string) => {
    setChildren(group.children.filter((entry) => entry.id !== id));
  };

  const toggleCombinator = () =>
    onChange({ ...group, combinator: group.combinator === "and" ? "or" : "and" });

  const isNested = depth > 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        isNested && "rounded border border-border bg-background-secondary p-1"
      )}
    >
      {group.children.map((child, index) => (
        <Fragment key={child.id}>
          {index > 0 && (
            <button
              type="button"
              onClick={toggleCombinator}
              aria-label={`Match ${group.combinator === "and" ? "all" : "any"} of these conditions, click to switch`}
              className="rounded px-1 text-xs text-text-tertiary transition-colors hover:bg-background-secondary hover:text-text"
            >
              {group.combinator}
            </button>
          )}

          {isFilterGroup(child) ? (
            <GroupEditor
              columns={columns}
              group={child}
              onChange={(next) => replaceChild(child.id, next)}
              onRemove={() => removeChild(child.id)}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          ) : (
            <ConditionChip
              column={columns.find((entry) => entry.id === child.columnId)}
              condition={child}
              onUpdate={(patch) => replaceChild(child.id, { ...child, ...patch })}
              onRemove={() => removeChild(child.id)}
            />
          )}
        </Fragment>
      ))}

      <FieldPicker
        columns={columns}
        onSelect={addCondition}
        trigger={
          <button type="button" aria-label="Add filter" className={CHIP_ADD_CLASS}>
            <Plus className="size-3" />
            {group.children.length === 0 && <span>Filter</span>}
          </button>
        }
      />

      {depth < maxDepth && (
        <button
          type="button"
          onClick={addGroup}
          aria-label="Add filter group"
          title="Add a nested group"
          className={CHIP_ADD_CLASS}
        >
          <Parentheses className="size-3" />
        </button>
      )}

      {onRemove && (
        <button
          type="button"
          aria-label="Remove filter group"
          onClick={onRemove}
          className="flex h-7 items-center rounded px-1 text-text-tertiary transition-colors hover:bg-background hover:text-text"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

interface ConditionChipProps<T> {
  column: CrmColumnDef<T> | undefined;
  condition: CrmFilterCondition;
  onUpdate: (patch: Partial<CrmFilterCondition>) => void;
  onRemove: () => void;
}

function ConditionChip<T>({
  column,
  condition,
  onUpdate,
  onRemove,
}: ConditionChipProps<T>) {
  // A stored condition can outlive the column it referenced, so it is shown as
  // removable rather than silently dropped.
  if (!column) {
    return (
      <div className="flex items-center divide-x divide-border overflow-hidden rounded border border-border bg-background">
        <span className="flex h-7 items-center px-2 text-xs text-text-tertiary">
          Unknown field
        </span>
        <button
          type="button"
          aria-label="Remove unknown filter"
          onClick={onRemove}
          className="flex h-7 items-center px-1.5 text-text-tertiary transition-colors hover:bg-background-secondary hover:text-text"
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }

  const type = column.type ?? "text";
  const Icon = getColumnTypeIcon(type);
  const operators = columnOperators(column);

  return (
    <div className="flex items-center divide-x divide-border overflow-hidden rounded border border-border bg-background">
      <span className="flex h-7 items-center gap-1.5 px-2 text-xs text-text">
        <Icon className="size-3 text-text-tertiary" />
        {column.header}
      </span>

      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={CHIP_BUTTON_CLASS}>
            {OPERATOR_LABELS[condition.operator]}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-1">
          <div className="flex flex-col">
            {operators.map((operator) => (
              <button
                key={operator}
                type="button"
                onClick={() =>
                  onUpdate({
                    operator,
                    value: resetValueForOperator(operator, type),
                    value2: null,
                  })
                }
                className={cn(
                  "rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-background-secondary",
                  operator === condition.operator && "bg-background-secondary"
                )}
              >
                {OPERATOR_LABELS[operator]}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {operatorNeedsValue(condition.operator) && (
        <ValueEditor
          column={column}
          condition={condition}
          onUpdate={onUpdate}
        />
      )}

      <button
        type="button"
        aria-label={`Remove ${column.header} filter`}
        onClick={onRemove}
        className="flex h-7 items-center px-1.5 text-text-tertiary transition-colors hover:bg-background-secondary hover:text-text"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

function resetValueForOperator(
  operator: CrmFilterOperator,
  type: CrmColumnType
): string | string[] | null {
  if (!operatorNeedsValue(operator)) return null;
  if (operator === "is_any_of" || operator === "is_none_of") return [];
  return type === "select" ? [] : "";
}

interface ValueEditorProps<T> {
  column: CrmColumnDef<T>;
  condition: CrmFilterCondition;
  onUpdate: (patch: Partial<CrmFilterCondition>) => void;
}

function ValueEditor<T>({ column, condition, onUpdate }: ValueEditorProps<T>) {
  const type = column.type ?? "text";

  if (type === "select") {
    return (
      <MultiSelectValue
        options={column.filterOptions ?? []}
        value={Array.isArray(condition.value) ? condition.value : []}
        onChange={(value) => onUpdate({ value })}
      />
    );
  }

  if (type === "date") {
    const isDayCount =
      condition.operator === "in_last_days" ||
      condition.operator === "in_next_days";

    if (isDayCount) {
      return (
        <span className="flex h-7 items-center gap-1 px-2">
          <input
            type="number"
            min={1}
            aria-label={`${column.header} days`}
            value={typeof condition.value === "string" ? condition.value : ""}
            onChange={(event) => onUpdate({ value: event.target.value })}
            className="h-5 w-12 border-0 bg-transparent p-0 text-xs text-text focus:outline-none focus:ring-0"
          />
          <span className="text-xs text-text-secondary">days</span>
        </span>
      );
    }

    return (
      <span className="flex h-7 items-center gap-1 px-2">
        <input
          type="date"
          aria-label={column.header}
          value={typeof condition.value === "string" ? condition.value : ""}
          onChange={(event) => onUpdate({ value: event.target.value })}
          className="h-5 border-0 bg-transparent p-0 text-xs text-text focus:outline-none focus:ring-0"
        />
        {condition.operator === "between" && (
          <>
            <span className="text-xs text-text-tertiary">and</span>
            <input
              type="date"
              aria-label={`${column.header} end`}
              value={condition.value2 ?? ""}
              onChange={(event) => onUpdate({ value2: event.target.value })}
              className="h-5 border-0 bg-transparent p-0 text-xs text-text focus:outline-none focus:ring-0"
            />
          </>
        )}
      </span>
    );
  }

  return (
    <span className="flex h-7 items-center px-2">
      <input
        type={type === "number" ? "number" : "text"}
        aria-label={column.header}
        placeholder="value"
        value={typeof condition.value === "string" ? condition.value : ""}
        onChange={(event) => onUpdate({ value: event.target.value })}
        className="h-5 w-20 border-0 bg-transparent p-0 text-xs text-text placeholder:text-text-tertiary focus:outline-none focus:ring-0"
      />
    </span>
  );
}

interface MultiSelectValueProps {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}

function MultiSelectValue({
  options,
  value,
  onChange,
}: MultiSelectValueProps) {
  const label =
    value.length === 0
      ? "select"
      : value.length === 1
        ? options.find((option) => option.value === value[0])?.label ?? value[0]
        : `${value.length} selected`;

  const toggle = (optionValue: string) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((entry) => entry !== optionValue)
        : [...value, optionValue]
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            CHIP_BUTTON_CLASS,
            value.length === 0 && "text-text-tertiary"
          )}
        >
          <span className="max-w-32 truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-64 w-56 overflow-y-auto p-1"
      >
        <div className="flex flex-col">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-background-secondary"
            >
              <Checkbox
                checked={value.includes(option.value)}
                onCheckedChange={() => toggle(option.value)}
              />
              <span className="truncate text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
