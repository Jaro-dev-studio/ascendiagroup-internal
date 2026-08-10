"use client";

import { useRef, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { ColumnDef, SortState } from "./types";
import { getColumnValue } from "./utils";

interface TableViewProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  sort: SortState;
  onSort: (columnId: string) => void;
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  clickableRows?: boolean;
  highlightIds?: string[];
  renderActions?: (row: T) => React.ReactNode;
  emptyMessage: React.ReactNode;
}

export function TableView<T>({
  data,
  columns,
  sort,
  onSort,
  getRowId,
  onRowClick,
  clickableRows = true,
  highlightIds = [],
  renderActions,
  emptyMessage,
}: TableViewProps<T>) {
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);

  // Scroll to highlighted row
  useEffect(() => {
    if (highlightIds.length > 0 && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightIds]);

  const getSortIcon = (columnId: string) => {
    if (sort.column !== columnId) {
      return <ArrowUpDown className="ml-1 inline size-3 text-text-secondary" />;
    }
    if (sort.direction === "asc") {
      return <ArrowUp className="ml-1 inline size-3" />;
    }
    return <ArrowDown className="ml-1 inline size-3" />;
  };

  const handleRowClick = (row: T) => {
    if (onRowClick && clickableRows) {
      onRowClick(row);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.id}
              className={`${column.width || ""} ${column.minWidth || ""} ${
                column.sortable
                  ? "cursor-pointer select-none hover:bg-background-secondary/50"
                  : ""
              }`}
              onClick={column.sortable ? () => onSort(column.id) : undefined}
            >
              {column.header}
              {column.sortable && getSortIcon(column.id)}
            </TableHead>
          ))}
          {renderActions && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={columns.length + (renderActions ? 1 : 0)}
              className="py-8 text-center text-text-secondary"
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          data.map((row) => {
            const rowId = getRowId(row);
            const isHighlighted = highlightIds.includes(rowId);
            const isFirstHighlighted = isHighlighted && highlightIds.indexOf(rowId) === 0;

            return (
              <TableRow
                key={rowId}
                ref={isFirstHighlighted ? highlightedRowRef : undefined}
                className={`${
                  clickableRows && onRowClick
                    ? "cursor-pointer hover:bg-background-secondary/50"
                    : ""
                } ${
                  isHighlighted
                    ? "relative z-10 outline outline-2 outline-primary-500"
                    : ""
                }`}
                onClick={() => handleRowClick(row)}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={`${column.width || ""} ${column.minWidth || ""}`}
                  >
                    {column.cell ? (
                      column.cell(row)
                    ) : (
                      <span className="truncate">
                        {String(getColumnValue(row, column) ?? "")}
                      </span>
                    )}
                  </TableCell>
                ))}
                {renderActions && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {renderActions(row)}
                  </TableCell>
                )}
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
