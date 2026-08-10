"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Clock,
  FileText,
  Handshake,
  Mail,
  Pencil,
  Trash2,
  UserCheck,
} from "lucide-react";
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
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { NoteComposer } from "@/components/crm/note-composer";
import { RecordTabs, type RecordTab } from "@/components/crm/record-tabs";
import { DetailField } from "@/components/crm/detail-field";
import { PricingTypeBadges } from "@/components/crm/pricing-type-badges";
import { CrmPersonModal } from "@/components/modals/crm-person-modal";
import { deleteCrmNote, deletePerson, updatePerson } from "@/lib/actions/crm";
import {
  LIFECYCLE_STAGE_CLASSES,
  LIFECYCLE_STAGE_LABELS,
  formatCurrency,
} from "@/constants/crm";
import { ENROLLMENT_STATUS_LABELS } from "@/constants/sequences";
import { cn, formatCrmDate, formatCrmDateTime } from "@/lib/utils";
import type { CrmOwner, PersonDetail, TimelineEntry } from "@/lib/fetchers/crm";

interface PersonDetailClientProps {
  person: PersonDetail;
  timeline: TimelineEntry[];
  companies: Array<{ id: string; name: string }>;
  owners: CrmOwner[];
}

const TABS: RecordTab[] = [
  { id: "activity", label: "Activity", icon: Clock },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "deals", label: "Deals", icon: Handshake },
  { id: "sequences", label: "Sequences", icon: Mail },
];

function ownerLabel(owner: CrmOwner | null): string {
  if (!owner) return "Unassigned";
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ");
  return name || owner.email;
}

export function PersonDetailClient({
  person,
  timeline,
  companies,
  owners,
}: PersonDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("activity");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const displayName =
    person.fullName ||
    [person.firstName, person.lastName].filter(Boolean).join(" ") ||
    person.email ||
    "Unnamed contact";

  const handleToggleDoNotContact = useCallback(() => {
    startTransition(async () => {
      await updatePerson(person.id, { doNotContact: !person.doNotContact });
      router.refresh();
    });
  }, [person.doNotContact, person.id, router]);

  const handleDelete = useCallback(() => {
    startTransition(async () => {
      await deletePerson(person.id);
      router.push("/dashboard/crm/people");
    });
  }, [person.id, router]);

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      startTransition(async () => {
        await deleteCrmNote(noteId);
        router.refresh();
      });
    },
    [router]
  );

  const tabs = TABS.map((tab) => {
    if (tab.id === "notes") {
      return { ...tab, label: `Notes (${person.crmNotes.length})` };
    }
    if (tab.id === "deals") {
      return { ...tab, label: `Deals (${person.deals.length})` };
    }
    if (tab.id === "sequences") {
      return { ...tab, label: `Sequences (${person.enrollments.length})` };
    }
    return { ...tab, label: `Activity (${timeline.length})` };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-row items-start gap-3">
          <Link href="/dashboard/crm/people" aria-label="Back to people">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-row flex-wrap items-center gap-2">
              <h1 className="text-text-dark text-2xl font-bold">
                {displayName}
              </h1>
              <Badge
                className={cn(
                  "text-xs font-medium",
                  LIFECYCLE_STAGE_CLASSES[person.lifecycleStage]
                )}
              >
                {LIFECYCLE_STAGE_LABELS[person.lifecycleStage]}
              </Badge>
              {person.doNotContact && (
                <Badge className="bg-danger-100 text-xs text-danger-700">
                  Do not contact
                </Badge>
              )}
            </div>
            <p className="text-text-secondary">
              {[person.jobTitle, person.company?.name]
                .filter(Boolean)
                .join(" at ") || "No company on record"}
            </p>
          </div>
        </div>

        <div className="flex flex-row flex-wrap gap-2">
          <Button variant="outline" onClick={() => setIsEditOpen(true)}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={handleToggleDoNotContact}
            disabled={isPending}
          >
            {person.doNotContact ? (
              <UserCheck className="mr-2 size-4" />
            ) : (
              <Ban className="mr-2 size-4" />
            )}
            {person.doNotContact ? "Allow contact" : "Do not contact"}
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
              <NoteComposer personId={person.id} />
              {person.crmNotes.length === 0 ? (
                <Card className="p-6">
                  <p className="text-center text-sm text-text-secondary">
                    No notes on this contact yet.
                  </p>
                </Card>
              ) : (
                person.crmNotes.map((note) => (
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

          {activeTab === "deals" && (
            <div className="flex flex-col gap-3">
              {person.deals.length === 0 ? (
                <Card className="p-6">
                  <p className="text-center text-sm text-text-secondary">
                    No deals linked to this contact.
                  </p>
                </Card>
              ) : (
                person.deals.map((deal) => (
                  <Link key={deal.id} href={`/dashboard/crm/deals/${deal.id}`}>
                    <Card variant="interactive" className="p-4">
                      <div className="flex flex-row items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <p className="text-text-dark truncate text-sm font-medium">
                            {deal.name}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {deal.stage.name}
                          </p>
                          <PricingTypeBadges
                            items={deal.pricingItems}
                            hideWhenEmpty
                          />
                        </div>
                        <p className="text-text-dark shrink-0 text-sm font-semibold">
                          {formatCurrency(deal.value, deal.currency)}
                        </p>
                      </div>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          )}

          {activeTab === "sequences" && (
            <div className="flex flex-col gap-3">
              {person.enrollments.length === 0 ? (
                <Card className="p-6">
                  <p className="text-center text-sm text-text-secondary">
                    This contact is not enrolled in any sequence.
                  </p>
                </Card>
              ) : (
                person.enrollments.map((enrollment) => (
                  <Card key={enrollment.id} className="p-4">
                    <div className="flex flex-row items-center justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/crm/sequences/${enrollment.sequence.id}`}
                          className="text-text-dark truncate text-sm font-medium hover:underline"
                        >
                          {enrollment.sequence.name}
                        </Link>
                        <p className="text-xs text-text-secondary">
                          Step {enrollment.currentStep}
                          {enrollment.nextSendAt
                            ? ` · next ${formatCrmDateTime(enrollment.nextSendAt)}`
                            : ""}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {ENROLLMENT_STATUS_LABELS[enrollment.status] ??
                          enrollment.status}
                      </Badge>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <h2 className="text-text-dark mb-3 text-sm font-semibold">
              Details
            </h2>
            <dl className="flex flex-col gap-3">
              <DetailField label="Email">
                {person.email ? (
                  <a
                    href={`mailto:${person.email}`}
                    className="text-primary-600 hover:underline"
                  >
                    {person.email}
                  </a>
                ) : (
                  "—"
                )}
              </DetailField>
              <DetailField label="Phone">{person.phone ?? "—"}</DetailField>
              <DetailField label="LinkedIn">
                {person.linkedinUrl ? (
                  <a
                    href={person.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    View profile
                  </a>
                ) : (
                  "—"
                )}
              </DetailField>
              <DetailField label="Company">
                {person.company ? (
                  <Link
                    href={`/dashboard/crm/companies/${person.company.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    {person.company.name}
                  </Link>
                ) : (
                  "—"
                )}
              </DetailField>
              <DetailField label="Owner">{ownerLabel(person.owner)}</DetailField>
              <DetailField label="Source">{person.source ?? "—"}</DetailField>
              <DetailField label="Added">
                {formatCrmDate(person.createdAt)}
              </DetailField>
            </dl>
          </Card>

          {person.description && (
            <Card className="p-4">
              <h2 className="text-text-dark mb-2 text-sm font-semibold">
                About
              </h2>
              <p className="whitespace-pre-wrap text-sm text-text-secondary">
                {person.description}
              </p>
            </Card>
          )}
        </div>
      </div>

      <CrmPersonModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => router.refresh()}
        companies={companies}
        owners={owners}
        person={{
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
        }}
      />

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete contact</DialogTitle>
            <DialogDescription>
              {displayName} and their notes and timeline entries will be
              permanently removed.
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
