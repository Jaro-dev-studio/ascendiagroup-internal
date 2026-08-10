"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Filter,
  Loader2,
  Mail,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Settings,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RecordTabs, type RecordTab } from "@/components/crm/record-tabs";
import { DetailField } from "@/components/crm/detail-field";
import { SequenceSettingsModal } from "@/components/modals/sequence-settings-modal";
import { SequenceStepModal } from "@/components/modals/sequence-step-modal";
import { SequenceEnrollModal } from "@/components/modals/sequence-enroll-modal";
import {
  deleteSequenceStep,
  enrollMatchingEntryCriteria,
  moveSequenceStep,
  removeEnrollment,
  setEnrollmentStatus,
  setSequenceStatus,
} from "@/lib/actions/sequences";
import { countActiveConditions } from "@/components/crm-table/utils";
import type { CrmFilterDynamicOptions } from "@/lib/crm/filters/columns";
import {
  ENROLLMENT_STATUS_CLASSES,
  ENROLLMENT_STATUS_LABELS,
  ENROLLMENT_STATUS_ORDER,
  SEQUENCE_STATUS_CLASSES,
  SEQUENCE_STATUS_LABELS,
  formatStepDelay,
} from "@/constants/sequences";
import { cn, formatCrmDateTime } from "@/lib/utils";
import type {
  SequenceDetail,
  SequenceStepView,
} from "@/lib/fetchers/sequences";

interface SequenceDetailClientProps {
  sequence: SequenceDetail;
  mailboxes: Array<{ email: string; name: string }>;
  enrollableContacts: Array<{
    id: string;
    name: string;
    email: string;
    companyName: string | null;
  }>;
  filterOptions: CrmFilterDynamicOptions;
}

function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return formatCrmDateTime(value);
}

function percentage(part: number, whole: number): string {
  if (whole === 0) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

export function SequenceDetailClient({
  sequence,
  mailboxes,
  enrollableContacts,
  filterOptions,
}: SequenceDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("steps");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [stepModal, setStepModal] = useState<{
    isOpen: boolean;
    step: SequenceStepView | null;
  }>({ isOpen: false, step: null });
  const [stepToDelete, setStepToDelete] = useState<SequenceStepView | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const criteriaCount = countActiveConditions(sequence.entryFilters);
  const exitCriteriaCount = countActiveConditions(sequence.exitFilters);

  const totalSent = sequence.steps.reduce((sum, step) => sum + step.sent, 0);
  const totalOpened = sequence.steps.reduce((sum, step) => sum + step.opened, 0);
  const totalReplied = sequence.counts.REPLIED;

  const handleStatus = async (status: "ACTIVE" | "PAUSED") => {
    setPendingId(sequence.id);
    setFeedback(null);

    const result = await setSequenceStatus(sequence.id, status);
    setPendingId(null);

    if (result.error) {
      setFeedback(result.error);
      return;
    }
    router.refresh();
  };

  const handleEnrollMatching = async () => {
    setPendingId(sequence.id);
    setFeedback(null);

    const result = await enrollMatchingEntryCriteria(sequence.id);
    setPendingId(null);

    if (result.error || !result.data) {
      setFeedback(result.error ?? "Failed to enroll matching contacts");
      return;
    }

    setFeedback(
      result.data.enrolled === 0
        ? "Everyone matching the entry criteria is already enrolled."
        : `Enrolled ${result.data.enrolled} matching contact${result.data.enrolled === 1 ? "" : "s"}.`
    );
    router.refresh();
  };

  const handleMoveStep = async (
    step: SequenceStepView,
    direction: "up" | "down"
  ) => {
    setPendingId(step.id);
    await moveSequenceStep(step.id, direction);
    setPendingId(null);
    router.refresh();
  };

  const handleDeleteStep = async () => {
    if (!stepToDelete) return;
    setPendingId(stepToDelete.id);
    await deleteSequenceStep(stepToDelete.id);
    setPendingId(null);
    setStepToDelete(null);
    router.refresh();
  };

  const handleEnrollmentStatus = async (
    enrollmentId: string,
    status: "ACTIVE" | "PAUSED" | "STOPPED"
  ) => {
    setPendingId(enrollmentId);
    setFeedback(null);

    const result = await setEnrollmentStatus(enrollmentId, status);
    setPendingId(null);

    if (result.error) {
      setFeedback(result.error);
      return;
    }
    router.refresh();
  };

  const handleRemoveEnrollment = async (enrollmentId: string) => {
    setPendingId(enrollmentId);
    await removeEnrollment(enrollmentId);
    setPendingId(null);
    router.refresh();
  };

  const tabs: RecordTab[] = [
    { id: "steps", label: "Steps", icon: Mail, count: sequence.steps.length },
    {
      id: "enrollments",
      label: "Contacts",
      icon: Users,
      count: sequence.enrollments.length,
    },
    { id: "stats", label: "Performance", icon: BarChart3 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/crm/sequences"
          className="flex w-fit flex-row items-center gap-1 text-sm text-secondary-500 hover:text-secondary-900"
        >
          <ArrowLeft className="size-4" />
          All sequences
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-row flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-secondary-900">
                {sequence.name}
              </h1>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  SEQUENCE_STATUS_CLASSES[sequence.status]
                )}
              >
                {SEQUENCE_STATUS_LABELS[sequence.status]}
              </span>
            </div>
            {sequence.description && (
              <p className="text-secondary-500">{sequence.description}</p>
            )}
          </div>

          <div className="flex flex-row items-center gap-2">
            {pendingId === sequence.id && (
              <Loader2 className="size-4 animate-spin text-secondary-400" />
            )}
            {sequence.status === "ACTIVE" ? (
              <Button
                variant="outline"
                onClick={() => handleStatus("PAUSED")}
                className="gap-2"
              >
                <Pause className="size-4" />
                Pause
              </Button>
            ) : (
              <Button
                onClick={() => handleStatus("ACTIVE")}
                disabled={sequence.steps.length === 0}
                className="gap-2"
              >
                <Play className="size-4" />
                Activate
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setIsSettingsOpen(true)}
              className="gap-2"
            >
              <Settings className="size-4" />
              Settings
            </Button>
            {criteriaCount > 0 && (
              <Button
                variant="outline"
                onClick={handleEnrollMatching}
                disabled={pendingId === sequence.id}
                className="gap-2"
              >
                <Filter className="size-4" />
                Enroll matching
              </Button>
            )}
            <Button onClick={() => setIsEnrollOpen(true)} className="gap-2">
              <UserPlus className="size-4" />
              Enroll
            </Button>
          </div>
        </div>
      </div>

      {feedback && (
        <Card className="p-4">
          <p className="text-sm text-secondary-700">{feedback}</p>
        </Card>
      )}

      <Card className="p-5">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="Sends from">{sequence.senderEmail}</DetailField>
          <DetailField label="Send window">
            {sequence.sendWindowStart}:00–{sequence.sendWindowEnd}:00{" "}
            {sequence.timezone}
            {sequence.sendOnWeekends ? ", incl. weekends" : ", weekdays only"}
          </DetailField>
          <DetailField label="Daily limit">
            {sequence.dailySendLimit} emails
          </DetailField>
          <DetailField label="Exits on">
            {[
              sequence.stopOnReply ? "reply" : null,
              sequence.stopOnMeetingBooked ? "meeting booked" : null,
              "unsubscribe",
              exitCriteriaCount > 0
                ? `${exitCriteriaCount} custom condition${exitCriteriaCount === 1 ? "" : "s"}`
                : null,
            ]
              .filter(Boolean)
              .join(", ")}
          </DetailField>
          <DetailField label="Entry criteria">
            {criteriaCount === 0
              ? "None"
              : `${criteriaCount} condition${criteriaCount === 1 ? "" : "s"}${
                sequence.autoEnrollEnabled ? ", auto-enrolling" : ""
              }`}
          </DetailField>
        </dl>
      </Card>

      <RecordTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "steps" && (
        <div className="flex flex-col gap-3">
          {sequence.steps.length === 0 ? (
            <Card className="p-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <Mail className="size-8 text-secondary-300" />
                <div>
                  <p className="font-medium text-secondary-900">No steps yet</p>
                  <p className="mt-1 text-sm text-secondary-500">
                    The first step opens the conversation; every later step can
                    reply in the same thread.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            sequence.steps.map((step, index) => (
              <Card key={step.id} className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-row flex-wrap items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-secondary-100 text-xs font-semibold text-secondary-700">
                        {step.order}
                      </span>
                      <span className="truncate font-medium text-secondary-900">
                        {step.subject}
                      </span>
                    </div>
                    <p className="text-sm text-secondary-500">
                      {formatStepDelay(step.delayDays, step.delayHours)}
                      {step.sendInThread ? " · replies in thread" : " · new thread"}
                    </p>
                    <p className="text-xs text-secondary-400">
                      {step.sent} sent · {step.opened} opened (
                      {percentage(step.opened, step.sent)}) · {step.clicked}{" "}
                      clicked · {step.replied} replied
                      {step.bounced > 0 && ` · ${step.bounced} bounced`}
                      {step.failed > 0 && ` · ${step.failed} failed`}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-row items-center gap-1">
                    {pendingId === step.id && (
                      <Loader2 className="size-4 animate-spin text-secondary-400" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMoveStep(step, "up")}
                      disabled={index === 0}
                    >
                      <ArrowUp className="size-4" />
                      <span className="sr-only">Move step up</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMoveStep(step, "down")}
                      disabled={index === sequence.steps.length - 1}
                    >
                      <ArrowDown className="size-4" />
                      <span className="sr-only">Move step down</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStepModal({ isOpen: true, step })}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setStepToDelete(step)}
                    >
                      <Trash2 className="size-4 text-danger-600" />
                      <span className="sr-only">Delete step</span>
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}

          <Button
            variant="outline"
            onClick={() => setStepModal({ isOpen: true, step: null })}
            className="w-fit gap-2"
          >
            <Plus className="size-4" />
            Add step
          </Button>
        </div>
      )}

      {activeTab === "enrollments" && (
        <Card className="p-5">
          {sequence.enrollments.length === 0 ? (
            <p className="py-6 text-center text-sm text-secondary-500">
              Nobody is enrolled yet.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {sequence.enrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-row flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/crm/people/${enrollment.personId}`}
                        className="truncate font-medium text-secondary-900 hover:underline"
                      >
                        {enrollment.personName}
                      </Link>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          ENROLLMENT_STATUS_CLASSES[enrollment.status]
                        )}
                      >
                        {ENROLLMENT_STATUS_LABELS[enrollment.status]}
                      </span>
                    </div>
                    <p className="text-sm text-secondary-500">
                      {enrollment.personEmail}
                      {enrollment.companyName ? ` · ${enrollment.companyName}` : ""}
                    </p>
                    <p className="text-xs text-secondary-400">
                      Step {enrollment.currentStep} of {sequence.steps.length} ·
                      last sent {formatDateTime(enrollment.lastSentAt)}
                      {enrollment.nextSendAt
                        ? ` · next ${formatDateTime(enrollment.nextSendAt)}`
                        : ""}
                      {enrollment.stoppedReason
                        ? ` · ${enrollment.stoppedReason}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-row items-center gap-2">
                    {pendingId === enrollment.id && (
                      <Loader2 className="size-4 animate-spin text-secondary-400" />
                    )}
                    {enrollment.status === "ACTIVE" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleEnrollmentStatus(enrollment.id, "PAUSED")
                        }
                        className="gap-1"
                      >
                        <Pause className="size-4" />
                        Pause
                      </Button>
                    )}
                    {enrollment.status === "PAUSED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleEnrollmentStatus(enrollment.id, "ACTIVE")
                        }
                        className="gap-1"
                      >
                        <Play className="size-4" />
                        Resume
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Enrollment actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {enrollment.status !== "STOPPED" && (
                          <DropdownMenuItem
                            onClick={() =>
                              handleEnrollmentStatus(enrollment.id, "STOPPED")
                            }
                          >
                            <X className="mr-2 size-4" />
                            Stop sequence
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleRemoveEnrollment(enrollment.id)}
                          className="text-danger-600"
                        >
                          <Trash2 className="mr-2 size-4" />
                          Remove from sequence
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === "stats" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Emails sent" value={String(totalSent)} />
            <StatCard
              label="Open rate"
              value={percentage(totalOpened, totalSent)}
              hint={
                sequence.trackOpens ? undefined : "Open tracking is off"
              }
            />
            <StatCard
              label="Reply rate"
              value={percentage(totalReplied, sequence.counts.ACTIVE + totalReplied + sequence.counts.COMPLETED)}
              hint={`${totalReplied} replies`}
            />
            <StatCard
              label="Bounced"
              value={String(sequence.counts.BOUNCED)}
            />
          </div>

          <Card className="p-5">
            <h2 className="font-medium text-secondary-900">
              Contacts by status
            </h2>
            <div className="mt-4 flex flex-col gap-2">
              {ENROLLMENT_STATUS_ORDER.map((status) => (
                <div
                  key={status}
                  className="flex flex-row items-center justify-between text-sm"
                >
                  <span className="text-secondary-500">
                    {ENROLLMENT_STATUS_LABELS[status]}
                  </span>
                  <span className="font-medium text-secondary-900">
                    {sequence.counts[status]}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-medium text-secondary-900">Step performance</h2>
            {sequence.steps.length === 0 ? (
              <p className="mt-3 text-sm text-secondary-500">
                Add steps to see per-step numbers.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {sequence.steps.map((step) => (
                  <div key={step.id} className="flex flex-col gap-1">
                    <div className="flex flex-row items-center justify-between text-sm">
                      <span className="truncate font-medium text-secondary-900">
                        {step.order}. {step.subject}
                      </span>
                      <span className="shrink-0 text-secondary-500">
                        {step.sent} sent · {percentage(step.opened, step.sent)}{" "}
                        opened · {step.replied} replied
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary-100">
                      <div
                        className="h-full rounded-full bg-primary-500"
                        style={{
                          width:
                            totalSent > 0
                              ? `${Math.round((step.sent / totalSent) * 100)}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      <SequenceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSuccess={() => router.refresh()}
        mailboxes={mailboxes}
        sequence={sequence}
        filterOptions={filterOptions}
      />

      <SequenceStepModal
        isOpen={stepModal.isOpen}
        onClose={() => setStepModal({ isOpen: false, step: null })}
        onSuccess={() => router.refresh()}
        sequenceId={sequence.id}
        step={stepModal.step}
        nextOrder={sequence.steps.length + 1}
      />

      <SequenceEnrollModal
        isOpen={isEnrollOpen}
        onClose={() => setIsEnrollOpen(false)}
        onSuccess={(summary) => {
          setFeedback(summary);
          router.refresh();
        }}
        sequenceId={sequence.id}
        initialContacts={enrollableContacts}
      />

      <AlertDialog
        open={Boolean(stepToDelete)}
        onOpenChange={(open) => !open && setStepToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this step?</AlertDialogTitle>
            <AlertDialogDescription>
              Step {stepToDelete?.order} is removed and the remaining steps are
              renumbered. Contacts who already passed this step keep their
              position and will not be re-sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleDeleteStep}>
              Delete
            </AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-sm text-secondary-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-secondary-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-secondary-400">{hint}</p>}
    </div>
  );
}
