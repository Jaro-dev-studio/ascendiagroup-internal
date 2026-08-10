"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ColumnDef, BoardGroupConfig } from "./types";
import { groupBy, getNestedValue } from "./utils";

interface BoardViewProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  groupBy: string;
  groupConfig: Record<string, BoardGroupConfig>;
  groupOrder?: string[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  highlightIds?: string[];
  renderCard?: (row: T) => React.ReactNode;
  emptyMessage: React.ReactNode;
}

export function BoardView<T>({
  data,
  columns,
  groupBy: groupByKey,
  groupConfig,
  groupOrder,
  getRowId,
  onRowClick,
  highlightIds = [],
  renderCard,
  emptyMessage,
}: BoardViewProps<T>) {
  // Group data by the specified key
  const groupedData = useMemo(() => {
    const groups = groupBy(data, groupByKey);
    return groups;
  }, [data, groupByKey]);

  // Determine column order
  const orderedGroups = useMemo(() => {
    if (groupOrder) {
      return groupOrder;
    }
    // Default to config keys order, then any additional groups found in data
    const configKeys = Object.keys(groupConfig);
    const dataKeys = Object.keys(groupedData);
    const uniqueDataKeys = dataKeys.filter((k) => !configKeys.includes(k));
    return [...configKeys, ...uniqueDataKeys];
  }, [groupConfig, groupedData, groupOrder]);

  // Get columns to show in board cards
  const boardColumns = useMemo(() => {
    return columns.filter((col) => col.showInBoard !== false);
  }, [columns]);

  const handleCardClick = (row: T) => {
    if (onRowClick) {
      onRowClick(row);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {orderedGroups.map((groupKey) => {
        const config = groupConfig[groupKey] || { label: groupKey };
        const items = groupedData[groupKey] || [];
        const Icon = config.icon;

        return (
          <div
            key={groupKey}
            className="rounded-lg border border-border bg-background-secondary/30 p-4"
          >
            {/* Column Header */}
            <div className="mb-4 flex items-center gap-2">
              {Icon && <Icon className="size-4 text-text-secondary" />}
              <h3 className="text-text-dark font-semibold">{config.label}</h3>
              <Badge variant="outline" className="ml-auto">
                {items.length}
              </Badge>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-3">
              {items.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-secondary">
                  No items
                </p>
              ) : (
                items.map((row) => {
                  const rowId = getRowId(row);
                  const isHighlighted = highlightIds.includes(rowId);

                  if (renderCard) {
                    return (
                      <div
                        key={rowId}
                        onClick={() => handleCardClick(row)}
                        className={`cursor-pointer rounded-lg border bg-background p-3 shadow-sm transition-shadow hover:shadow-md ${
                          isHighlighted
                            ? "border-primary-500 outline outline-2 outline-primary-500"
                            : "border-border"
                        }`}
                      >
                        {renderCard(row)}
                      </div>
                    );
                  }

                  // Default card rendering
                  return (
                    <DefaultBoardCard
                      key={rowId}
                      row={row}
                      columns={boardColumns}
                      isHighlighted={isHighlighted}
                      onClick={() => handleCardClick(row)}
                    />
                  );
                })
              )}
            </div>
          </div>
        );
      })}

      {/* Show empty message if no groups */}
      {orderedGroups.length === 0 && (
        <div className="col-span-full py-8 text-center text-text-secondary">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

// Default card component when no custom renderCard is provided
interface DefaultBoardCardProps<T> {
  row: T;
  columns: ColumnDef<T>[];
  isHighlighted: boolean;
  onClick: () => void;
}

function DefaultBoardCard<T>({
  row,
  columns,
  isHighlighted,
  onClick,
}: DefaultBoardCardProps<T>) {
  // Find the primary column (usually the first one, or one with id "name" or "title")
  const primaryColumn = columns.find(
    (col) => col.id === "name" || col.id === "title"
  ) || columns[0];

  // Get other columns for secondary info
  const secondaryColumns = columns.filter(
    (col) => col.id !== primaryColumn?.id
  ).slice(0, 3); // Show max 3 secondary fields

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-lg border bg-background p-3 shadow-sm transition-shadow hover:shadow-md ${
        isHighlighted
          ? "border-primary-500 outline outline-2 outline-primary-500"
          : "border-border"
      }`}
    >
      {/* Primary content */}
      {primaryColumn && (
        <div className="mb-2">
          {primaryColumn.boardCell ? (
            primaryColumn.boardCell(row)
          ) : primaryColumn.cell ? (
            primaryColumn.cell(row)
          ) : (
            <p className="text-text-dark font-medium">
              {String(getColumnValue(row, primaryColumn) ?? "")}
            </p>
          )}
        </div>
      )}

      {/* Secondary content */}
      {secondaryColumns.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {secondaryColumns.map((column) => (
            <div key={column.id} className="text-xs text-text-secondary">
              {column.boardCell ? (
                column.boardCell(row)
              ) : column.cell ? (
                column.cell(row)
              ) : (
                <span>{String(getColumnValue(row, column) ?? "")}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper to get column value - duplicated to avoid circular dependency
function getColumnValue<T>(row: T, column: ColumnDef<T>): unknown {
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
