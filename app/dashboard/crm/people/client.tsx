"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { CrmTable, type CrmColumnDef } from "@/components/crm-table";
import {
  ConnectionStrengthCell,
  NextEventCell,
  RelativeDateCell,
} from "@/components/crm/engagement-cells";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  CrmPersonModal,
  type PersonModalRecord,
} from "@/components/modals/crm-person-modal";
import { deletePerson } from "@/lib/actions/crm";
import {
  CONNECTION_STRENGTH_LABELS,
  CONNECTION_STRENGTH_ORDER,
  LIFECYCLE_STAGE_CLASSES,
  LIFECYCLE_STAGE_ICONS,
  LIFECYCLE_STAGE_LABELS,
  LIFECYCLE_STAGE_ORDER,
} from "@/constants/crm";
import { cn } from "@/lib/utils";
import type { CrmConnectionStrength } from "@prisma/client";
import type { CrmOwner, PersonListItem } from "@/lib/fetchers/crm";

interface PeopleClientProps {
  people: PersonListItem[];
  companies: Array<{ id: string; name: string }>;
  owners: CrmOwner[];
}

function ownerLabel(owner: CrmOwner | null): string {
  if (!owner) return "Unassigned";
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ");
  return name || owner.email;
}

function personName(person: PersonListItem): string {
  return (
    person.fullName ||
    [person.firstName, person.lastName].filter(Boolean).join(" ") ||
    person.email ||
    "Unnamed contact"
  );
}

function personInitials(person: PersonListItem): string {
  const initials = [person.firstName, person.lastName]
    .filter(Boolean)
    .map((part) => part![0])
    .join("");
  return (initials || personName(person)[0] || "?").toUpperCase();
}

/** Strongest ranks lowest so an ascending sort puts the best connections first. */
function strengthRank(strength: CrmConnectionStrength | null): number {
  if (!strength) return CONNECTION_STRENGTH_ORDER.length;
  return CONNECTION_STRENGTH_ORDER.indexOf(strength);
}

export function PeopleClient({ people, companies, owners }: PeopleClientProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<PersonModalRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PersonListItem | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreate = useCallback(() => {
    setEditing(null);
    setIsModalOpen(true);
  }, []);

  const handleEdit = useCallback((person: PersonListItem) => {
    setEditing({
      id: person.id,
      email: person.email,
      firstName: person.firstName,
      lastName: person.lastName,
      jobTitle: person.jobTitle,
      phone: person.phone,
      linkedinUrl: person.linkedinUrl,
      lifecycleStage: person.lifecycleStage,
      companyId: person.company?.id ?? null,
      ownerId: person.owner?.id ?? null,
    });
    setIsModalOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    await deletePerson(pendingDelete.id);
    setIsDeleting(false);
    setPendingDelete(null);
    router.refresh();
  }, [pendingDelete, router]);

  const columns: CrmColumnDef<PersonListItem>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Person",
        type: "text",
        accessorFn: (row) => personName(row),
        width: 260,
        pinned: true,
        sortable: true,
        filterable: true,
        cell: (row) => (
          <div className="flex items-center gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background-secondary text-[10px] font-medium text-text-secondary">
              {personInitials(row)}
            </span>
            <span className="truncate font-medium text-text">
              {personName(row)}
            </span>
          </div>
        ),
      },
      {
        id: "email",
        header: "Email",
        type: "text",
        accessorKey: "email",
        width: 220,
        sortable: true,
        filterable: true,
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
        // Sorts strongest first rather than alphabetically
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
        id: "company",
        header: "Company",
        type: "select",
        accessorKey: "company.name",
        filterValueFn: (row) => row.company?.id ?? null,
        width: 180,
        sortable: true,
        filterable: true,
        filterOptions: companies.map((company) => ({
          value: company.id,
          label: company.name,
        })),
        cell: (row) => (
          <span className="block truncate text-text-secondary">
            {row.company?.name ?? "—"}
          </span>
        ),
      },
      {
        id: "lifecycleStage",
        header: "Stage",
        type: "select",
        accessorKey: "lifecycleStage",
        width: 140,
        sortable: true,
        filterable: true,
        filterOptions: LIFECYCLE_STAGE_ORDER.map((stage) => ({
          value: stage,
          label: LIFECYCLE_STAGE_LABELS[stage],
          icon: LIFECYCLE_STAGE_ICONS[stage],
        })),
        cell: (row) => (
          <Badge
            className={cn(
              "text-xs font-medium",
              LIFECYCLE_STAGE_CLASSES[row.lifecycleStage]
            )}
          >
            {LIFECYCLE_STAGE_LABELS[row.lifecycleStage]}
          </Badge>
        ),
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
        id: "sequences",
        header: "Sequences",
        type: "number",
        accessorKey: "activeSequences",
        width: 120,
        sortable: true,
        filterable: true,
        cell: (row) =>
          row.activeSequences > 0 ? (
            <Badge variant="secondary" className="text-xs">
              {row.activeSequences} active
            </Badge>
          ) : (
            <span className="text-text-tertiary">—</span>
          ),
      },
      {
        id: "contactable",
        header: "Contactable",
        type: "select",
        accessorFn: (row) => (row.doNotContact ? "no" : "yes"),
        width: 140,
        filterable: true,
        filterOptions: [
          { value: "yes", label: "Contactable" },
          { value: "no", label: "Do not contact" },
        ],
        cell: (row) =>
          row.doNotContact ? (
            <Badge className="bg-danger-100 text-xs text-danger-700">
              Do not contact
            </Badge>
          ) : (
            <span className="text-text-tertiary">—</span>
          ),
      },
      {
        id: "createdAt",
        header: "Created at",
        type: "date",
        accessorKey: "createdAt",
        width: 140,
        sortable: true,
        filterable: true,
      },
    ],
    [companies, owners]
  );

  const renderActions = useCallback(
    (row: PersonListItem) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={(event) => event.stopPropagation()}
            aria-label={`Actions for ${personName(row)}`}
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
    [handleEdit]
  );

  const searchFn = useCallback((row: PersonListItem, query: string) => {
    const haystack = [
      personName(row),
      row.email,
      row.jobTitle,
      row.company?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.toLowerCase());
  }, []);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-text-dark text-2xl font-bold">People</h1>
          <p className="text-text-secondary">
            Every contact across your pipeline
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 size-4" />
          New contact
        </Button>
      </div>

      <CrmTable
        data={people}
        columns={columns}
        storageKey="crm-people"
        searchable
        searchPlaceholder="Search contacts..."
        searchFn={searchFn}
        getRowId={(person) => person.id}
        onRowClick={(person) => router.push(`/dashboard/crm/people/${person.id}`)}
        renderActions={renderActions}
        enableRowSelection
        rowLabel="contact"
        defaultSort={{ column: "createdAt", direction: "desc" }}
        emptyMessage="No contacts yet. Create your first contact."
        emptyFilteredMessage="No contacts match your search or filters."
      />

      <CrmPersonModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => router.refresh()}
        companies={companies}
        owners={owners}
        person={editing}
      />

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete contact</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `${personName(pendingDelete)} and their notes and timeline entries will be permanently removed.`
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
