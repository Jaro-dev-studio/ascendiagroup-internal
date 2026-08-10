"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  FileText,
  Handshake,
  Pencil,
  Sparkles,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { NoteComposer } from "@/components/crm/note-composer";
import { RecordTabs, type RecordTab } from "@/components/crm/record-tabs";
import { DetailField } from "@/components/crm/detail-field";
import { CompanyBrand } from "@/components/crm/company-brand";
import { CompanyResearch } from "@/components/crm/company-research";
import { PricingTypeBadges } from "@/components/crm/pricing-type-badges";
import { CrmCompanyModal } from "@/components/modals/crm-company-modal";
import { deleteCrmNote } from "@/lib/actions/crm";
import {
  COMPANY_STATUS_CLASSES,
  COMPANY_STATUS_LABELS,
  LIFECYCLE_STAGE_CLASSES,
  LIFECYCLE_STAGE_LABELS,
  formatCurrency,
} from "@/constants/crm";
import { cn, formatCrmDate, formatCrmDateTime } from "@/lib/utils";
import type { CompanyDetail, CrmOwner, TimelineEntry } from "@/lib/fetchers/crm";

interface CompanyDetailClientProps {
  company: CompanyDetail;
  timeline: TimelineEntry[];
  owners: CrmOwner[];
}

const TABS: RecordTab[] = [
  { id: "research", label: "Research", icon: Sparkles },
  { id: "activity", label: "Activity", icon: Clock },
  { id: "people", label: "People", icon: Users },
  { id: "deals", label: "Deals", icon: Handshake },
  { id: "calls", label: "Calls", icon: Video },
  { id: "notes", label: "Notes", icon: FileText },
];

function ownerLabel(owner: CrmOwner | null): string {
  if (!owner) return "Unassigned";
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ");
  return name || owner.email;
}

function normaliseUrl(value: string): string {
  return value.startsWith("http") ? value : `https://${value}`;
}

export function CompanyDetailClient({
  company,
  timeline,
  owners,
}: CompanyDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("research");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [, startTransition] = useTransition();

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      startTransition(async () => {
        await deleteCrmNote(noteId);
        router.refresh();
      });
    },
    [router]
  );

  const tabs: RecordTab[] = TABS.map((tab) => {
    switch (tab.id) {
      case "research":
        return company.researchOpportunities.length > 0
          ? { ...tab, label: `Research (${company.researchOpportunities.length})` }
          : tab;
      case "activity":
        return { ...tab, label: `Activity (${timeline.length})` };
      case "people":
        return { ...tab, label: `People (${company.people.length})` };
      case "deals":
        return { ...tab, label: `Deals (${company.deals.length})` };
      case "calls":
        return { ...tab, label: `Calls (${company.meetings.length})` };
      default:
        return { ...tab, label: `Notes (${company.crmNotes.length})` };
    }
  });

  const websiteUrl = company.website || company.domain;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-row items-start gap-3">
          <Link href="/dashboard/crm/companies" aria-label="Back to companies">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-row flex-wrap items-center gap-2">
              <h1 className="text-text-dark text-2xl font-bold">
                {company.name}
              </h1>
              <Badge
                className={cn(
                  "text-xs font-medium",
                  COMPANY_STATUS_CLASSES[company.status]
                )}
              >
                {COMPANY_STATUS_LABELS[company.status]}
              </Badge>
            </div>
            <p className="text-text-secondary">
              {[company.industry, company.domain].filter(Boolean).join(" · ") ||
                "No industry on record"}
            </p>
          </div>
        </div>

        <div className="flex flex-row flex-wrap gap-2">
          {websiteUrl && (
            <a
              href={normaliseUrl(websiteUrl)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline">
                <ExternalLink className="mr-2 size-4" />
                Website
              </Button>
            </a>
          )}
          <Button variant="outline" onClick={() => setIsEditOpen(true)}>
            <Pencil className="mr-2 size-4" />
            Edit
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

          {activeTab === "research" && (
            <CompanyResearch
              companyId={company.id}
              summary={company.researchSummary}
              opportunities={company.researchOpportunities}
              discoveryQuestions={company.researchDiscoveryQuestions}
              sources={company.researchSources}
              confidence={company.researchConfidence}
              status={company.researchStatus}
              error={company.researchError}
              researchedAt={company.researchedAt}
            />
          )}

          {activeTab === "activity" && <ActivityTimeline entries={timeline} />}

          {activeTab === "people" && (
            <div className="flex flex-col gap-3">
              {company.people.length === 0 ? (
                <Card className="p-6">
                  <p className="text-center text-sm text-text-secondary">
                    No contacts at this company yet.
                  </p>
                </Card>
              ) : (
                company.people.map((person) => (
                  <Link
                    key={person.id}
                    href={`/dashboard/crm/people/${person.id}`}
                  >
                    <Card variant="interactive" className="p-4">
                      <div className="flex flex-row items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-text-dark truncate text-sm font-medium">
                            {person.fullName || person.email || "Unnamed"}
                          </p>
                          <p className="truncate text-xs text-text-secondary">
                            {[person.jobTitle, person.email]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            "shrink-0 text-xs",
                            LIFECYCLE_STAGE_CLASSES[person.lifecycleStage]
                          )}
                        >
                          {LIFECYCLE_STAGE_LABELS[person.lifecycleStage]}
                        </Badge>
                      </div>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          )}

          {activeTab === "deals" && (
            <div className="flex flex-col gap-3">
              {company.deals.length === 0 ? (
                <Card className="p-6">
                  <p className="text-center text-sm text-text-secondary">
                    No deals for this company.
                  </p>
                </Card>
              ) : (
                company.deals.map((deal) => (
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

          {activeTab === "calls" && (
            <div className="flex flex-col gap-3">
              {company.meetings.length === 0 ? (
                <Card className="p-6">
                  <p className="text-center text-sm text-text-secondary">
                    No recorded calls with this company.
                  </p>
                </Card>
              ) : (
                company.meetings.map((meeting) => (
                  <Link
                    key={meeting.id}
                    href={`/dashboard/calls?meeting=${meeting.id}`}
                  >
                    <Card variant="interactive" className="p-4">
                      <div className="flex flex-row items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-text-dark truncate text-sm font-medium">
                            {meeting.title}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {formatCrmDateTime(meeting.startTime)}
                          </p>
                        </div>
                        {meeting.callType && (
                          <Badge
                            variant="secondary"
                            className="shrink-0 text-xs"
                          >
                            {meeting.callType}
                          </Badge>
                        )}
                      </div>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          )}

          {activeTab === "notes" && (
            <div className="flex flex-col gap-4">
              <NoteComposer companyId={company.id} />
              {company.crmNotes.length === 0 ? (
                <Card className="p-6">
                  <p className="text-center text-sm text-text-secondary">
                    No notes on this company yet.
                  </p>
                </Card>
              ) : (
                company.crmNotes.map((note) => (
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
            <h2 className="text-text-dark mb-3 text-sm font-semibold">
              Details
            </h2>
            <dl className="flex flex-col gap-3">
              <DetailField label="Domain">{company.domain ?? "—"}</DetailField>
              <DetailField label="Industry">
                {company.industry ?? "—"}
              </DetailField>
              <DetailField label="Employees">
                {company.employeeCount ?? "—"}
              </DetailField>
              <DetailField label="LinkedIn">
                {company.linkedinUrl ? (
                  <a
                    href={company.linkedinUrl}
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
              <DetailField label="Owner">{ownerLabel(company.owner)}</DetailField>
              <DetailField label="Added">
                {formatCrmDate(company.createdAt)}
              </DetailField>
            </dl>
          </Card>

          <CompanyBrand
            name={company.name}
            logoUrl={company.logoUrl}
            primaryColor={company.primaryColor}
            secondaryColor={company.secondaryColor}
            accentColor={company.accentColor}
          />

          {company.description && (
            <Card className="p-4">
              <h2 className="text-text-dark mb-2 text-sm font-semibold">
                About
              </h2>
              <p className="whitespace-pre-wrap text-sm text-text-secondary">
                {company.description}
              </p>
            </Card>
          )}
        </div>
      </div>

      <CrmCompanyModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => router.refresh()}
        owners={owners}
        company={{
          id: company.id,
          name: company.name,
          domain: company.domain,
          website: company.website,
          industry: company.industry,
          employeeCount: company.employeeCount,
          linkedinUrl: company.linkedinUrl,
          description: company.description,
          ownerId: company.owner?.id ?? null,
        }}
      />
    </div>
  );
}
