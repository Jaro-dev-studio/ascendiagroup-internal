import type { ColumnDef } from "@/components/data-table";
import type { CrmColumnDef } from "./types";

/**
 * Maps CRM table columns onto the shape the existing DataTable board renderer
 * expects, so a page can offer the Attio-style table and keep its kanban view
 * without maintaining two sets of column definitions.
 *
 * Only what a board card renders is carried across: sizing, pinning, filtering
 * and sorting have no meaning on a card.
 */
export function toBoardColumns<T>(
  columns: CrmColumnDef<T>[]
): ColumnDef<T>[] {
  return columns.map((column) => ({
    id: column.id,
    header: column.header,
    accessorKey: column.accessorKey,
    accessorFn: column.accessorFn,
    cell: column.cell,
    boardCell: column.boardCell,
    showInBoard: column.showInBoard,
  }));
}
