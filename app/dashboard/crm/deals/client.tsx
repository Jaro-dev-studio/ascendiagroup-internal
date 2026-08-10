"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CrmDealModal,
  type DealModalRecord,
} from "@/components/modals/crm-deal-modal";
import { PricingTypeBadges } from "@/components/crm/pricing-type-badges";
import { deleteDeal, updateDealStage } from "@/lib/actions/crm";
import {
  DEAL_PRICING_TYPE_LABELS,
  DEAL_PRICING_TYPE_OPTIONS,
  formatCurrency,
} from "@/constants/crm";
import { formatCrmDate } from "@/lib/utils";
import type { CrmOwner, DealListItem } from "@/lib/fetchers/crm";

interface DealsClientProps {
  deals: DealListItem[];
  stages: Array<{
    id: string;
    name: string;
    order: number;
    isWon: boolean;
    isLost: boolean;
  }>;
  companies: Array<{ id: string; name: string }>;
  people: Array<{ id: string; label: string; companyId: string | null }>;
  owners: CrmOwner[];
}

function ownerLabel(owner: CrmOwner | null): string {
  if (!owner) return "Unassigned";
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ");
  return name || owner.email;
}

export function DealsClient({
  deals,
  stages,
  companies,
  people,
  owners,
}: DealsClientProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<DealModalRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DealListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const summary = useMemo(() => {
    const open = deals.filter((deal) => !deal.wonAt && !deal.lostAt);
    const won = deals.filter((deal) => Boolean(deal.wonAt));
    const openValue = open.reduce((total, deal) => total + deal.value, 0);
    const wonValue = won.reduce((total, deal) => total + deal.value, 0);
    const weighted = open.reduce(
      (total, deal) => total + (deal.value * deal.stage.probability) / 100,
      0
    );
    return {
      openCount: open.length,
      wonCount: won.length,
      openValue,
      wonValue,
      weighted,
    };
  }, [deals]);

  const handleCreate = useCallback(() => {
    setEditing(null);
    setIsModalOpen(true);
  }, []);

  const handleEdit = useCallback((deal: DealListItem) => {
    setEditing({
      id: deal.id,
      name: deal.name,
      value: deal.value,
      currency: deal.currency,
      pricingItems: deal.pricingItems,
      stageId: deal.stage.id,
      companyId: deal.company?.id ?? null,
      primaryPersonId: deal.primaryPerson?.id ?? null,
      ownerId: deal.owner?.id ?? null,
      closeDate: deal.closeDate,
    });
    setIsModalOpen(true);
  }, []);

  const handleMoveStage = useCallback(
    async (dealId: string, stageId: string) => {
      await updateDealStage(dealId, stageId);
      router.refresh();
    },
    [router]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    await deleteDeal(pendingDelete.id);
    setIsDeleting(false);
    setPendingDelete(null);
    router.refresh();
  }, [pendingDelete, router]);

  const columns: ColumnDef<DealListItem>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Deal",
        accessorKey: "name",
        width: "w-1/4",
        sortable: true,
        cell: (row) => (
          <div className="flex flex-col">
            <p className="text-text-dark truncate font-medium">{row.name}</p>
            {row.company && (
              <p className="truncate text-xs text-text-secondary">
                {row.company.name}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "stage",
        header: "Stage",
        accessorKey: "stage.name",
        width: "w-44",
        sortable: true,
        sortFn: (a, b, direction) => {
          const comparison = a.stage.order - b.stage.order;
          return direction === "asc" ? comparison : -comparison;
        },
        filterable: true,
        filterType: "multi-select",
        filterOptions: stages.map((stage) => ({
          value: stage.id,
          label: stage.name,
        })),
        filterFn: (row, value) => {
          if (!value || (Array.isArray(value) && value.length === 0)) return true;
          return Array.isArray(value) && value.includes(row.stage.id);
        },
        showInBoard: false,
        cell: (row) => (
          <Badge variant="secondary" className="text-xs">
            {row.stage.name}
          </Badge>
        ),
      },
      {
        id: "value",
        header: "Value",
        accessorKey: "value",
        width: "w-28",
        sortable: true,
        cell: (row) => (
          <p className="text-text-dark text-sm font-medium">
            {formatCurrency(row.value, row.currency)}
          </p>
        ),
      },
      {
        id: "pricing",
        header: "Pricing",
        accessorKey: "pricingItems",
        width: "w-40",
        filterable: true,
        filterType: "multi-select",
        filterOptions: DEAL_PRICING_TYPE_OPTIONS.map((type) => ({
          value: type,
          label: DEAL_PRICING_TYPE_LABELS[type],
        })),
        filterFn: (row, value) => {
          if (!value || (Array.isArray(value) && value.length === 0)) return true;
          return (
            Array.isArray(value) &&
            row.pricingItems.some((item) => value.includes(item.type))
          );
        },
        showInBoard: false,
        cell: (row) => <PricingTypeBadges items={row.pricingItems} />,
      },
      {
        id: "contact",
        header: "Contact",
        accessorKey: "primaryPerson.fullName",
        width: "w-40",
        sortable: true,
        cell: (row) => (
          <p className="truncate text-sm text-text-secondary">
            {row.primaryPerson?.fullName ?? row.primaryPerson?.email ?? "—"}
          </p>
        ),
      },
      {
        id: "owner",
        header: "Owner",
        accessorKey: "owner.email",
        width: "w-36",
        sortable: true,
        filterable: true,
        filterType: "multi-select",
        filterOptions: [
          { value: "unassigned", label: "Unassigned" },
          ...owners.map((owner) => ({
            value: owner.id,
            label: ownerLabel(owner),
          })),
        ],
        filterFn: (row, value) => {
          if (!value || (Array.isArray(value) && value.length === 0)) return true;
          const key = row.owner?.id ?? "unassigned";
          return Array.isArray(value) && value.includes(key);
        },
        cell: (row) => (
          <p className="truncate text-sm text-text-secondary">
            {ownerLabel(row.owner)}
          </p>
        ),
      },
      {
        id: "closeDate",
        header: "Close date",
        accessorKey: "closeDate",
        width: "w-28",
        sortable: true,
        cell: (row) => (
          <p className="text-sm text-text-secondary">
            {row.closeDate ? formatCrmDate(row.closeDate) : "—"}
          </p>
        ),
      },
      {
        id: "createdAt",
        header: "Created",
        accessorKey: "createdAt",
        width: "w-28",
        sortable: true,
        showInBoard: false,
        cell: (row) => (
          <p className="text-sm text-text-secondary">
            {formatCrmDate(row.createdAt)}
          </p>
        ),
      },
    ],
    [owners, stages]
  );

  const renderActions = useCallback(
    (row: DealListItem) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={(event) => event.stopPropagation()}
            aria-label={`Actions for ${row.name}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              handleEdit(row);
            }}
          >
            <Pencil className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to stage</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {stages.map((stage) => (
                <DropdownMenuItem
                  key={stage.id}
                  disabled={stage.id === row.stage.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleMoveStage(row.id, stage.id);
                  }}
                >
                  {stage.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              setPendingDelete(row);
            }}
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    [handleEdit, handleMoveStage, stages]
  );

  const renderBoardCard = useCallback(
    (row: DealListItem) => (
      <div className="flex flex-col gap-2">
        <p className="text-text-dark text-sm font-medium">{row.name}</p>
        {row.company && (
          <p className="text-xs text-text-secondary">{row.company.name}</p>
        )}
        <PricingTypeBadges items={row.pricingItems} hideWhenEmpty />
        <div className="flex flex-row items-center justify-between">
          <p className="text-text-dark text-sm font-semibold">
            {formatCurrency(row.value, row.currency)}
          </p>
          <p className="text-xs text-text-tertiary">{ownerLabel(row.owner)}</p>
        </div>
      </div>
    ),
    []
  );

  const searchFn = useCallback((row: DealListItem, query: string) => {
    const haystack = [
      row.name,
      row.company?.name,
      row.primaryPerson?.fullName,
      row.primaryPerson?.email,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.toLowerCase());
  }, []);

  const boardGroupConfig = useMemo(
    () =>
      stages.reduce<Record<string, { label: string }>>(
        (config, stage) => ({ ...config, [stage.id]: { label: stage.name } }),
        {}
      ),
    [stages]
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-text-dark text-2xl font-bold">Deals</h1>
          <p className="text-text-secondary">
            Your sales pipeline across every stage
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 size-4" />
          New deal
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase text-text-tertiary">Open deals</p>
          <p className="text-text-dark mt-1 text-2xl font-bold">
            {summary.openCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-text-tertiary">Open value</p>
          <p className="text-text-dark mt-1 text-2xl font-bold">
            {formatCurrency(summary.openValue, "USD")}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-text-tertiary">Weighted</p>
          <p className="text-text-dark mt-1 text-2xl font-bold">
            {formatCurrency(Math.round(summary.weighted), "USD")}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-text-tertiary">Won</p>
          <p className="text-text-dark mt-1 text-2xl font-bold">
            {formatCurrency(summary.wonValue, "USD")}
          </p>
        </Card>
      </div>

      <DataTable
        data={deals}
        columns={columns}
        storageKey="crm-deals"
        searchable
        searchPlaceholder="Search deals..."
        searchFn={searchFn}
        enableBoardView
        boardGroupBy="stage.id"
        boardGroupConfig={boardGroupConfig}
        boardGroupOrder={stages.map((stage) => stage.id)}
        renderBoardCard={renderBoardCard}
        getRowId={(deal) => deal.id}
        onRowClick={(deal) => router.push(`/dashboard/crm/deals/${deal.id}`)}
        renderActions={renderActions}
        pageSize={25}
        defaultSort={{ column: "value", direction: "desc" }}
        emptyMessage="No deals yet. Create your first deal."
        emptyFilteredMessage="No deals match your search or filters."
      />

      <CrmDealModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => router.refresh()}
        stages={stages}
        companies={companies}
        people={people}
        owners={owners}
        deal={editing}
      />

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete deal</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `"${pendingDelete.name}" will be permanently removed along with its notes and timeline entries.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
