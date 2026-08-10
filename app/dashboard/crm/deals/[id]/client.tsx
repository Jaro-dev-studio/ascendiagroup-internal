"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, FileText, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { NoteComposer } from "@/components/crm/note-composer";
import { RecordTabs, type RecordTab } from "@/components/crm/record-tabs";
import { DetailField } from "@/components/crm/detail-field";
import { CrmDealModal } from "@/components/modals/crm-deal-modal";
import { deleteCrmNote, deleteDeal, updateDealStage } from "@/lib/actions/crm";
import { DEAL_PRICING_TYPE_LABELS, formatCurrency } from "@/constants/crm";
import {
  dealMonthlyRecurring,
  describePricingItem,
  pricingItemAmount,
} from "@/lib/crm/deal-pricing";
import { formatCrmDate, formatCrmDateTime } from "@/lib/utils";
import type { CrmOwner, DealDetail, TimelineEntry } from "@/lib/fetchers/crm";

interface DealDetailClientProps {
  deal: DealDetail;
  timeline: TimelineEntry[];
  companies: Array<{ id: string; name: string }>;
  people: Array<{ id: string; label: string; companyId: string | null }>;
  owners: CrmOwner[];
}

const TABS: RecordTab[] = [
  { id: "activity", label: "Activity", icon: Clock },
  { id: "notes", label: "Notes", icon: FileText },
];

function ownerLabel(owner: CrmOwner | null): string {
  if (!owner) return "Unassigned";
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ");
  return name || owner.email;
}

export function DealDetailClient({
  deal,
  timeline,
  companies,
  people,
  owners,
}: DealDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("activity");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleStageChange = useCallback(
    (stageId: string) => {
      startTransition(async () => {
        await updateDealStage(deal.id, stageId);
        router.refresh();
      });
    },
    [deal.id, router]
  );

  const handleDelete = useCallback(() => {
    startTransition(async () => {
      await deleteDeal(deal.id);
      router.push("/dashboard/crm/deals");
    });
  }, [deal.id, router]);

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      startTransition(async () => {
        await deleteCrmNote(noteId);
        router.refresh();
      });
    },
    [router]
  );

  const tabs: RecordTab[] = TABS.map((tab) =>
    tab.id === "activity"
      ? { ...tab, label: `Activity (${timeline.length})` }
      : { ...tab, label: `Notes (${deal.crmNotes.length})` }
  );

  const monthlyRecurring = dealMonthlyRecurring(deal.pricingItems);

  const outcomeBadge = deal.wonAt
    ? { label: "Won", className: "bg-success-100 text-success-700" }
    : deal.lostAt
      ? { label: "Lost", className: "bg-danger-100 text-danger-700" }
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-row items-start gap-3">
          <Link href="/dashboard/crm/deals" aria-label="Back to deals">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-row flex-wrap items-center gap-2">
              <h1 className="text-text-dark text-2xl font-bold">{deal.name}</h1>
              {outcomeBadge && (
                <Badge className={`text-xs font-medium ${outcomeBadge.className}`}>
                  {outcomeBadge.label}
                </Badge>
              )}
            </div>
            <p className="text-text-secondary">
              {formatCurrency(deal.value, deal.currency)}
              {deal.company ? ` · ${deal.company.name}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-row flex-wrap gap-2">
          <Button variant="outline" onClick={() => setIsEditOpen(true)}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Button>
          <Button variant="destructive" onClick={() => setIsDeleteOpen(true)}>
            <Trash2 className="mr-2 size-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <RecordTabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={setActiveTab}
          />

          {activeTab === "activity" && <ActivityTimeline entries={timeline} />}

          {activeTab === "notes" && (
            <div className="flex flex-col gap-4">
              <NoteComposer dealId={deal.id} />
              {deal.crmNotes.length === 0 ? (
                <Card className="p-6">
                  <p className="text-center text-sm text-text-secondary">
                    No notes on this deal yet.
                  </p>
                </Card>
              ) : (
                deal.crmNotes.map((note) => (
                  <Card key={note.id} className="p-4">
                    <div className="flex flex-row items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {note.title && (
                          <p className="text-text-dark text-sm font-medium">
                            {note.title}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words text-sm text-text-secondary">
                          {note.content}
                        </p>
                        <p className="mt-2 text-xs text-text-tertiary">
                          {formatCrmDateTime(note.createdAt)}
                          {note.authorEmail ? ` · ${note.authorEmail}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteNote(note.id)}
                        aria-label="Delete note"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <h2 className="text-text-dark mb-3 text-sm font-semibold">Stage</h2>
            <Select
              value={deal.stage.id}
              onValueChange={handleStageChange}
              disabled={isPending}
            >
              <SelectTrigger aria-label="Deal stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {deal.pipeline.stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          <Card className="p-4">
            <h2 className="text-text-dark mb-3 text-sm font-semibold">
              Pricing
            </h2>
            {deal.pricingItems.length === 0 ? (
              <p className="text-sm text-text-secondary">
                No pricing structure set. Edit the deal to add project, hourly
                or retainer items.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {deal.pricingItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-1">
                    <div className="flex flex-row items-baseline justify-between gap-2">
                      <p className="text-text-dark text-sm font-medium">
                        {item.label || DEAL_PRICING_TYPE_LABELS[item.type]}
                      </p>
                      <p className="text-text-dark shrink-0 text-sm font-semibold">
                        {formatCurrency(
                          pricingItemAmount(item),
                          deal.currency
                        )}
                      </p>
                    </div>
                    <p className="text-xs text-text-secondary">
                      {DEAL_PRICING_TYPE_LABELS[item.type]} ·{" "}
                      {describePricingItem(item, deal.currency)}
                    </p>
                  </div>
                ))}

                <div className="flex flex-col gap-1 border-t border-border pt-3">
                  <div className="flex flex-row items-baseline justify-between gap-2">
                    <p className="text-sm text-text-secondary">
                      Contract value
                    </p>
                    <p className="text-text-dark text-base font-semibold">
                      {formatCurrency(deal.value, deal.currency)}
                    </p>
                  </div>
                  {monthlyRecurring > 0 && (
                    <div className="flex flex-row items-baseline justify-between gap-2">
                      <p className="text-xs text-text-secondary">
                        Recurring per month
                      </p>
                      <p className="text-xs font-medium text-text-secondary">
                        {formatCurrency(
                          Math.round(monthlyRecurring),
                          deal.currency
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-text-dark mb-3 text-sm font-semibold">
              Details
            </h2>
            <dl className="flex flex-col gap-3">
              <DetailField label="Contract value">
                {formatCurrency(deal.value, deal.currency)}
              </DetailField>
              <DetailField label="Pipeline">{deal.pipeline.name}</DetailField>
              <DetailField label="Company">
                {deal.company ? (
                  <Link
                    href={`/dashboard/crm/companies/${deal.company.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    {deal.company.name}
                  </Link>
                ) : (
                  "—"
                )}
              </DetailField>
              <DetailField label="Primary contact">
                {deal.primaryPerson ? (
                  <Link
                    href={`/dashboard/crm/people/${deal.primaryPerson.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    {deal.primaryPerson.fullName ||
                      deal.primaryPerson.email ||
                      "Unnamed"}
                  </Link>
                ) : (
                  "—"
                )}
              </DetailField>
              <DetailField label="Owner">{ownerLabel(deal.owner)}</DetailField>
              <DetailField label="Expected close">
                {deal.closeDate ? formatCrmDate(deal.closeDate) : "—"}
              </DetailField>
              {deal.lostReason && (
                <DetailField label="Lost reason">{deal.lostReason}</DetailField>
              )}
              <DetailField label="Created">
                {formatCrmDate(deal.createdAt)}
              </DetailField>
            </dl>
          </Card>
        </div>
      </div>

      <CrmDealModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => router.refresh()}
        stages={deal.pipeline.stages}
        companies={companies}
        people={people}
        owners={owners}
        deal={{
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
        }}
      />

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete deal</DialogTitle>
            <DialogDescription>
              &quot;{deal.name}&quot; will be permanently removed along with its
              notes and timeline entries.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
