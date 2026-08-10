"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Building2, ExternalLink } from "lucide-react";
import {
  CrmTable,
  toBoardColumns,
  type CrmColumnDef,
} from "@/components/crm-table";
import { BoardView } from "@/components/data-table";
import {
  ConnectionStrengthCell,
  NextEventCell,
  RelativeDateCell,
} from "@/components/crm/engagement-cells";
import { Badge } from "@/components/ui/badge";
import {
  COMPANY_STATUS_CLASSES,
  COMPANY_STATUS_ICONS,
  COMPANY_STATUS_LABELS,
  COMPANY_STATUS_ORDER,
  CONNECTION_STRENGTH_LABELS,
  CONNECTION_STRENGTH_ORDER,
} from "@/constants/crm";
import { cn } from "@/lib/utils";
import type { CrmConnectionStrength } from "@prisma/client";
import type { CompanyListItem, CrmOwner } from "@/lib/fetchers/crm";

interface CompaniesClientProps {
  companies: CompanyListItem[];
  owners: CrmOwner[];
}

function ownerLabel(owner: CrmOwner | null): string {
  if (!owner) return "Unassigned";
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ");
  return name || owner.email;
}

function normaliseUrl(value: string): string {
  return value.startsWith("http") ? value : `https://${value}`;
}

/** Strongest ranks lowest so an ascending sort puts the best connections first. */
function strengthRank(strength: CrmConnectionStrength | null): number {
  if (!strength) return CONNECTION_STRENGTH_ORDER.length;
  return CONNECTION_STRENGTH_ORDER.indexOf(strength);
}

export function CompaniesClient({ companies, owners }: CompaniesClientProps) {
  const router = useRouter();

  const industries = useMemo(() => {
    const unique = new Set<string>();
    companies.forEach((company) => {
      if (company.industry) unique.add(company.industry);
    });
    return Array.from(unique).sort();
  }, [companies]);

  const columns: CrmColumnDef<CompanyListItem>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Company",
        type: "text",
        accessorKey: "name",
        width: 260,
        pinned: true,
        sortable: true,
        filterable: true,
        cell: (row) => (
          <div className="flex flex-row items-center gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded bg-secondary-100">
              <Building2 className="size-3 text-secondary-600" aria-hidden />
            </span>
            <span className="truncate font-medium text-text">{row.name}</span>
            {row.domain && (
              <span className="truncate text-xs text-text-tertiary">
                {row.domain}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "connectionStrength",
        header: "Connection strength",
        type: "select",
        accessorKey: "connectionStrength",
        width: 170,
        sortable: true,
        filterable: true,
        filterOptions: CONNECTION_STRENGTH_ORDER.map((strength) => ({
          value: strength,
          label: CONNECTION_STRENGTH_LABELS[strength],
        })),
        sortFn: (a, b, direction) => {
          const comparison =
            strengthRank(a.connectionStrength) -
            strengthRank(b.connectionStrength);
          return direction === "asc" ? comparison : -comparison;
        },
        cell: (row) => (
          <ConnectionStrengthCell strength={row.connectionStrength} />
        ),
      },
      {
        id: "nextCalendarEvent",
        header: "Next calendar event",
        type: "date",
        accessorKey: "nextCalendarEventAt",
        width: 170,
        sortable: true,
        filterable: true,
        cell: (row) => (
          <NextEventCell
            at={row.nextCalendarEventAt}
            title={row.nextCalendarEventTitle}
          />
        ),
      },
      {
        id: "lastEmailInteraction",
        header: "Last email interaction",
        type: "date",
        accessorKey: "lastEmailInteractionAt",
        width: 180,
        sortable: true,
        filterable: true,
        cell: (row) => <RelativeDateCell value={row.lastEmailInteractionAt} />,
      },
      {
        id: "lastCalendarInteraction",
        header: "Last calendar interaction",
        type: "date",
        accessorKey: "lastCalendarInteractionAt",
        width: 195,
        sortable: true,
        filterable: true,
        cell: (row) => (
          <RelativeDateCell value={row.lastCalendarInteractionAt} />
        ),
      },
      {
        // Derived from the company's deals, so there is no inline editor here.
        id: "status",
        header: "Deal Status",
        type: "select",
        accessorKey: "status",
        width: 170,
        sortable: true,
        filterable: true,
        filterOptions: COMPANY_STATUS_ORDER.map((status) => ({
          value: status,
          label: COMPANY_STATUS_LABELS[status],
          icon: COMPANY_STATUS_ICONS[status],
        })),
        cell: (row) => (
          <Badge
            className={cn(
              "text-xs font-medium",
              COMPANY_STATUS_CLASSES[row.status]
            )}
          >
            {COMPANY_STATUS_LABELS[row.status]}
          </Badge>
        ),
      },
      {
        id: "industry",
        header: "Industry",
        type: "select",
        accessorKey: "industry",
        width: 170,
        sortable: true,
        filterable: true,
        filterOptions: industries.map((industry) => ({
          value: industry,
          label: industry,
        })),
      },
      {
        id: "owner",
        header: "Owner",
        type: "select",
        accessorKey: "owner.email",
        filterValueFn: (row) => row.owner?.id ?? "unassigned",
        width: 160,
        sortable: true,
        filterable: true,
        filterOptions: [
          { value: "unassigned", label: "Unassigned" },
          ...owners.map((owner) => ({
            value: owner.id,
            label: ownerLabel(owner),
          })),
        ],
        cell: (row) => (
          <span className="block truncate text-text-secondary">
            {ownerLabel(row.owner)}
          </span>
        ),
      },
      {
        id: "people",
        header: "Contacts",
        type: "number",
        accessorKey: "peopleCount",
        width: 110,
        sortable: true,
        filterable: true,
      },
      {
        id: "deals",
        header: "Deals",
        type: "number",
        accessorKey: "dealCount",
        width: 100,
        sortable: true,
        filterable: true,
      },
      {
        id: "meetings",
        header: "Calls",
        type: "number",
        accessorKey: "meetingCount",
        width: 100,
        sortable: true,
        filterable: true,
      },
      {
        id: "createdAt",
        header: "Created at",
        type: "date",
        accessorKey: "createdAt",
        width: 140,
        sortable: true,
        filterable: true,
        showInBoard: false,
      },
      {
        id: "website",
        header: "Site",
        type: "text",
        accessorKey: "website",
        width: 80,
        showInBoard: false,
        cell: (row) => {
          const url = row.website || row.domain;
          if (!url) return <span className="text-text-tertiary">—</span>;
          return (
            <a
              href={normaliseUrl(url)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="text-primary-600 hover:text-primary-700"
              aria-label={`Open ${row.name} website`}
            >
              <ExternalLink className="size-4" />
            </a>
          );
        },
      },
    ],
    [industries, owners]
  );

  const searchFn = useCallback((row: CompanyListItem, query: string) => {
    const haystack = [row.name, row.domain, row.website, row.industry]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.toLowerCase());
  }, []);

  // Kanban is still handled by the original DataTable board renderer, so the
  // pipeline view survives the move to the new table.
  const renderBoardView = useCallback(
    () => (
      <BoardView
        data={companies}
        columns={toBoardColumns(columns)}
        groupBy="status"
        groupConfig={COMPANY_STATUS_ORDER.reduce(
          (config, status) => ({
            ...config,
            [status]: {
              label: COMPANY_STATUS_LABELS[status],
              icon: COMPANY_STATUS_ICONS[status],
            },
          }),
          {}
        )}
        groupOrder={[...COMPANY_STATUS_ORDER]}
        getRowId={(company) => company.id}
        onRowClick={(company) =>
          router.push(`/dashboard/crm/companies/${company.id}`)
        }
        emptyMessage="No companies yet."
      />
    ),
    [companies, columns, router]
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-text-dark text-2xl font-bold">Companies</h1>
          <p className="text-text-secondary">
            Accounts, their contacts and pipeline status
          </p>
        </div>
      </div>

      <CrmTable
        data={companies}
        columns={columns}
        storageKey="crm-companies"
        searchable
        searchPlaceholder="Search companies..."
        searchFn={searchFn}
        enableBoardView
        renderBoardView={renderBoardView}
        getRowId={(company) => company.id}
        onRowClick={(company) =>
          router.push(`/dashboard/crm/companies/${company.id}`)
        }
        enableRowSelection
        rowLabel="company"
        defaultSort={{ column: "createdAt", direction: "desc" }}
        emptyMessage="No companies yet."
        emptyFilteredMessage="No companies match your search or filters."
      />
    </div>
  );
}
