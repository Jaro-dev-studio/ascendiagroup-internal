"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { SequenceSettingsModal } from "@/components/modals/sequence-settings-modal";
import {
  deleteSequence,
  runSequencesNow,
  setSequenceStatus,
  syncRepliesNow,
} from "@/lib/actions/sequences";
import {
  SEQUENCE_STATUS_CLASSES,
  SEQUENCE_STATUS_LABELS,
} from "@/constants/sequences";
import { cn } from "@/lib/utils";
import type { CrmFilterDynamicOptions } from "@/lib/crm/filters/columns";
import type { SequenceListItem } from "@/lib/fetchers/sequences";

interface SequencesClientProps {
  sequences: SequenceListItem[];
  mailboxes: Array<{ email: string; name: string }>;
  config: { gmailConfigured: boolean; workspaceDomain: string };
  filterOptions: CrmFilterDynamicOptions;
}

export function SequencesClient({
  sequences,
  mailboxes,
  config,
  filterOptions,
}: SequencesClientProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<SequenceListItem | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const totals = sequences.reduce(
    (accumulator, sequence) => ({
      active: accumulator.active + (sequence.status === "ACTIVE" ? 1 : 0),
      enrolled: accumulator.enrolled + sequence.activeEnrollments,
      sent: accumulator.sent + sequence.sent,
      replied: accumulator.replied + sequence.replied,
    }),
    { active: 0, enrolled: 0, sent: 0, replied: 0 }
  );

  const handleRun = async () => {
    setIsRunning(true);
    setFeedback(null);

    const [send, replies] = await Promise.all([
      runSequencesNow(),
      syncRepliesNow(),
    ]);

    setIsRunning(false);

    const messages: string[] = [];
    if (send.data) {
      messages.push(
        `${send.data.sent} sent, ${send.data.skipped} skipped, ${send.data.failed} failed`
      );
    }
    if (send.error) messages.push(`Send error: ${send.error}`);
    if (replies.data) {
      messages.push(
        `${replies.data.replies} replies and ${replies.data.bounces} bounces detected`
      );
    }
    if (replies.error) messages.push(`Reply sync error: ${replies.error}`);

    setFeedback(messages.join(" · "));
    router.refresh();
  };

  const handleStatus = async (
    sequence: SequenceListItem,
    status: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DRAFT"
  ) => {
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

  const handleDelete = async () => {
    if (!toDelete) return;
    setPendingId(toDelete.id);
    await deleteSequence(toDelete.id);
    setPendingId(null);
    setToDelete(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Sequences</h1>
          <p className="mt-1 text-secondary-500">
            Multi-step outbound sent from a real @{config.workspaceDomain}{" "}
            mailbox. Follow-ups thread onto the same conversation and stop the
            moment someone replies.
          </p>
        </div>
        <div className="flex flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleRun}
            disabled={isRunning || totals.active === 0}
            className="gap-2"
          >
            {isRunning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Run now
          </Button>
          <Button
            variant="outline"
            asChild
          >
            <Link href="/dashboard/crm/sequences/suppressions" className="gap-2">
              <Ban className="size-4" />
              Suppressions
            </Link>
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus className="size-4" />
            New sequence
          </Button>
        </div>
      </div>

      {!config.gmailConfigured && (
        <Card className="border-warning-200 bg-warning-50 p-4">
          <div className="flex flex-row items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-600" />
            <div className="text-sm text-warning-800">
              <p className="font-medium">Email sending is not configured</p>
              <p className="mt-1">
                Add GOOGLE_SERVICE_ACCOUNT_JSON and authorise the gmail.send and
                gmail.readonly scopes for domain-wide delegation before
                activating a sequence.
              </p>
            </div>
          </div>
        </Card>
      )}

      {feedback && (
        <Card className="p-4">
          <p className="text-sm text-secondary-700">{feedback}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Active sequences" value={totals.active} />
        <SummaryCard label="Contacts in flight" value={totals.enrolled} />
        <SummaryCard label="Emails sent" value={totals.sent} />
        <SummaryCard label="Replies" value={totals.replied} />
      </div>

      {sequences.length === 0 ? (
        <Card className="p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <Mail className="size-8 text-secondary-300" />
            <div>
              <p className="font-medium text-secondary-900">No sequences yet</p>
              <p className="mt-1 text-sm text-secondary-500">
                Create one, add your steps, then enroll contacts from the CRM.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {sequences.map((sequence) => (
            <Card key={sequence.id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-row flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/crm/sequences/${sequence.id}`}
                      className="font-medium text-secondary-900 hover:underline"
                    >
                      {sequence.name}
                    </Link>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        SEQUENCE_STATUS_CLASSES[sequence.status]
                      )}
                    >
                      {SEQUENCE_STATUS_LABELS[sequence.status]}
                    </span>
                    {sequence.autoEnrollEnabled && (
                      <Badge variant="outline">
                        Auto-enroll
                        {sequence.entryCriteriaCount > 0
                          ? `: ${sequence.entryCriteriaCount} condition${sequence.entryCriteriaCount === 1 ? "" : "s"}`
                          : ""}
                      </Badge>
                    )}
                  </div>
                  {sequence.description && (
                    <p className="text-sm text-secondary-500">
                      {sequence.description}
                    </p>
                  )}
                  <p className="text-sm text-secondary-500">
                    {sequence.stepCount} step
                    {sequence.stepCount === 1 ? "" : "s"} · from{" "}
                    {sequence.senderEmail}
                  </p>
                  <p className="text-xs text-secondary-400">
                    {sequence.activeEnrollments} in flight ·{" "}
                    {sequence.totalEnrollments} enrolled all-time ·{" "}
                    {sequence.sent} sent · {sequence.replied} replied
                  </p>
                </div>

                <div className="flex shrink-0 flex-row items-center gap-2">
                  {pendingId === sequence.id && (
                    <Loader2 className="size-4 animate-spin text-secondary-400" />
                  )}
                  {sequence.status === "ACTIVE" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatus(sequence, "PAUSED")}
                    >
                      Pause
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleStatus(sequence, "ACTIVE")}
                      disabled={
                        sequence.stepCount === 0 || !config.gmailConfigured
                      }
                      className="gap-2"
                    >
                      <Send className="size-4" />
                      Activate
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Sequence actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/sequences/${sequence.id}`}>
                          Open editor
                        </Link>
                      </DropdownMenuItem>
                      {sequence.status !== "ARCHIVED" && (
                        <DropdownMenuItem
                          onClick={() => handleStatus(sequence, "ARCHIVED")}
                        >
                          Archive
                        </DropdownMenuItem>
                      )}
                      {sequence.status === "ARCHIVED" && (
                        <DropdownMenuItem
                          onClick={() => handleStatus(sequence, "DRAFT")}
                        >
                          Move back to draft
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setToDelete(sequence)}
                        className="text-danger-600"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SequenceSettingsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(sequenceId) =>
          router.push(`/dashboard/crm/sequences/${sequenceId}`)
        }
        mailboxes={mailboxes}
        filterOptions={filterOptions}
      />

      <AlertDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this sequence?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.name} and its {toDelete?.totalEnrollments} enrollment
              record(s) will be removed. Emails already sent stay in the
              mailbox and on the contact timelines.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-sm text-secondary-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-secondary-900">{value}</p>
    </div>
  );
}
