"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Download,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { RecordingRuleModal } from "@/components/modals/recording-rule-modal";
import { JoinMeetingForm } from "@/components/forms/join-meeting-form";
import {
  cancelEventRecording,
  deleteRecordingRule,
  pollRecordingsNow,
  resetCalendarSyncToken,
  runCalendarSyncNow,
  testCalendarAccess,
  toggleRecordingRule,
} from "@/lib/actions/recording-rules";
import { cn, formatCrmDate, formatCrmDateTime } from "@/lib/utils";
import type {
  CalendarEventView,
  RecorderConfigStatus,
  RecordingRuleView,
} from "@/lib/fetchers/recording-rules";
import type { RecordingDecision } from "@prisma/client";

interface RecordingRulesClientProps {
  rules: RecordingRuleView[];
  events: CalendarEventView[];
  mailboxes: Array<{ userId: string; email: string; name: string }>;
  config: RecorderConfigStatus;
}

const DECISION_LABELS: Record<RecordingDecision, string> = {
  PENDING: "Pending",
  SCHEDULED: "Bot scheduled",
  SKIPPED: "Not recording",
  DUPLICATE: "Covered elsewhere",
  RECORDING: "Recording",
  COMPLETED: "Recorded",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const DECISION_CLASSES: Record<RecordingDecision, string> = {
  PENDING: "bg-secondary-100 text-secondary-700",
  SCHEDULED: "bg-primary-100 text-primary-700",
  SKIPPED: "bg-secondary-100 text-secondary-500",
  DUPLICATE: "bg-secondary-100 text-secondary-500",
  RECORDING: "bg-warning-100 text-warning-700",
  COMPLETED: "bg-success-100 text-success-700",
  FAILED: "bg-danger-100 text-danger-700",
  CANCELLED: "bg-secondary-100 text-secondary-500",
};

const PLATFORM_LABELS: Record<string, string> = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  microsoft_teams: "Teams",
  webex: "Webex",
};

function formatEventTime(start: Date, end: Date): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const time = `${startDate.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })} – ${endDate.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  return `${formatCrmDate(startDate)}, ${time}`;
}

function describeRule(rule: RecordingRuleView): string {
  const parts: string[] = [];
  parts.push(
    rule.requireExternalAttendee ? "external guests only" : "all meetings"
  );
  parts.push(`min ${rule.minAttendees} attendees`);
  parts.push(`joins ${rule.joinMinutesBefore} min early`);
  if (rule.titleIncludes.length > 0) {
    parts.push(`title contains ${rule.titleIncludes.join(" / ")}`);
  }
  if (rule.titleExcludes.length > 0) {
    parts.push(`skips ${rule.titleExcludes.join(" / ")}`);
  }
  return parts.join(" · ");
}

export function RecordingRulesClient({
  rules,
  events,
  mailboxes,
  config,
}: RecordingRulesClientProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecordingRuleView | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<RecordingRuleView | null>(
    null
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pendingRuleId, setPendingRuleId] = useState<string | null>(null);
  const [cancellingEventId, setCancellingEventId] = useState<string | null>(
    null
  );
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const isConfigured = config.googleConfigured && config.recallConfigured;

  const handleSync = async () => {
    setIsSyncing(true);
    setFeedback(null);

    const result = await runCalendarSyncNow();
    setIsSyncing(false);

    if (result.error) {
      setFeedback(result.error);
      return;
    }

    const summary = result.data;
    if (summary) {
      setFeedback(
        `Synced ${summary.calendarsProcessed} calendar(s): ${summary.botsScheduled} bot(s) scheduled, ` +
          `${summary.botsRescheduled} rescheduled, ${summary.botsCancelled} cancelled, ${summary.skipped} skipped.` +
          (summary.errors.length > 0
            ? ` ${summary.errors.length} error(s): ${summary.errors[0]}`
            : "")
      );
    }
    router.refresh();
  };

  const handlePoll = async () => {
    setIsPolling(true);
    setFeedback(null);

    const result = await pollRecordingsNow();
    setIsPolling(false);

    if (result.error) {
      setFeedback(result.error);
      return;
    }

    const summary = result.data;
    if (summary) {
      setFeedback(
        `Checked ${summary.checked} bot(s): ${summary.ingested} transcript(s) imported, ` +
          `${summary.transcriptsRequested} transcription(s) started, ${summary.stillWaiting} still processing, ` +
          `${summary.failed} failed.` +
          (summary.errors.length > 0
            ? ` ${summary.errors.length} error(s): ${summary.errors[0]}`
            : "")
      );
    }
    router.refresh();
  };

  const handleToggle = async (rule: RecordingRuleView, enabled: boolean) => {
    setPendingRuleId(rule.id);
    await toggleRecordingRule(rule.id, enabled);
    setPendingRuleId(null);
    router.refresh();
  };

  const handleTest = async (rule: RecordingRuleView) => {
    setPendingRuleId(rule.id);
    const result = await testCalendarAccess(rule.calendarEmail);
    setPendingRuleId(null);
    setTestResult((previous) => ({
      ...previous,
      [rule.id]: result.error ?? "Calendar access verified",
    }));
  };

  const handleReset = async (rule: RecordingRuleView) => {
    setPendingRuleId(rule.id);
    await resetCalendarSyncToken(rule.calendarEmail);
    setPendingRuleId(null);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!ruleToDelete) return;
    setPendingRuleId(ruleToDelete.id);
    await deleteRecordingRule(ruleToDelete.id);
    setPendingRuleId(null);
    setRuleToDelete(null);
    router.refresh();
  };

  const handleCancelEvent = async (eventId: string) => {
    setCancellingEventId(eventId);
    setFeedback(null);

    const result = await cancelEventRecording(eventId);
    setCancellingEventId(null);

    if (result.error) {
      setFeedback(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">
            Recording rules
          </h1>
          <p className="mt-1 text-secondary-500">
            Decides which calendars the notetaker joins. Calendars are synced
            every 10 minutes, bots are scheduled, moved or cancelled to match,
            and finished recordings are transcribed and imported automatically.
          </p>
        </div>
        <div className="flex flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={isSyncing || rules.length === 0}
            className="gap-2"
          >
            {isSyncing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Sync now
          </Button>
          <Button
            variant="outline"
            onClick={handlePoll}
            disabled={isPolling}
            className="gap-2"
          >
            {isPolling ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Fetch recordings
          </Button>
          <Button
            onClick={() => {
              setEditingRule(null);
              setIsModalOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="size-4" />
            Add calendar
          </Button>
        </div>
      </div>

      {!isConfigured && (
        <Card className="border-warning-200 bg-warning-50 p-4">
          <div className="flex flex-row items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-600" />
            <div className="text-sm text-warning-800">
              <p className="font-medium">Recorder is not fully configured</p>
              <ul className="mt-1 flex flex-col gap-1">
                {!config.googleConfigured && (
                  <li>
                    GOOGLE_SERVICE_ACCOUNT_JSON is missing, so calendars cannot
                    be read.
                  </li>
                )}
                {!config.recallConfigured && (
                  <li>
                    RECALL_API_KEY is missing, so no bots can be scheduled.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {feedback && (
        <Card className="p-4">
          <p className="text-sm text-secondary-700">{feedback}</p>
        </Card>
      )}

      <JoinMeetingForm
        onJoined={() => router.refresh()}
        disabled={!config.recallConfigured}
      />

      <div className="flex flex-col gap-3">
        {rules.length === 0 ? (
          <Card className="p-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <Video className="size-8 text-secondary-300" />
              <div>
                <p className="font-medium text-secondary-900">
                  No calendars are being recorded
                </p>
                <p className="mt-1 text-sm text-secondary-500">
                  Add a @{config.workspaceDomain} calendar to start joining
                  meetings automatically.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-row flex-wrap items-center gap-2">
                    <span className="font-medium text-secondary-900">
                      {rule.userName ?? rule.calendarEmail}
                    </span>
                    {!rule.enabled && (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                    {rule.scheduledCount > 0 && (
                      <Badge variant="outline">
                        {rule.scheduledCount} upcoming
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-secondary-500">
                    {rule.calendarEmail}
                  </p>
                  <p className="mt-1 text-sm text-secondary-500">
                    {describeRule(rule)}
                  </p>
                  <p className="text-xs text-secondary-400">
                    Bot name: {rule.botName}
                    {rule.lastSyncedAt
                      ? ` · last synced ${formatCrmDateTime(rule.lastSyncedAt)}`
                      : " · never synced"}
                  </p>
                  {rule.lastError && (
                    <p className="mt-1 text-xs text-danger-600">
                      Last sync error: {rule.lastError}
                    </p>
                  )}
                  {testResult[rule.id] && (
                    <p
                      className={cn(
                        "mt-1 text-xs",
                        testResult[rule.id] === "Calendar access verified"
                          ? "text-success-600"
                          : "text-danger-600"
                      )}
                    >
                      {testResult[rule.id]}
                    </p>
                  )}
                </div>

                <div className="flex flex-row items-center gap-2">
                  {pendingRuleId === rule.id && (
                    <Loader2 className="size-4 animate-spin text-secondary-400" />
                  )}
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) => handleToggle(rule, checked)}
                    aria-label={`Toggle recording for ${rule.calendarEmail}`}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Rule actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingRule(rule);
                          setIsModalOpen(true);
                        }}
                      >
                        Edit rule
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleTest(rule)}>
                        Test calendar access
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleReset(rule)}>
                        Force full resync
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setRuleToDelete(rule)}
                        className="text-danger-600"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Remove calendar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Card className="p-5">
        <div className="flex flex-row items-center gap-2">
          <CalendarClock className="size-4 text-secondary-400" />
          <h2 className="font-medium text-secondary-900">Upcoming meetings</h2>
        </div>

        {events.length === 0 ? (
          <p className="mt-3 text-sm text-secondary-500">
            Nothing synced yet. Add a calendar and run a sync.
          </p>
        ) : (
          <div className="mt-4 flex flex-col divide-y divide-border">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-row flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-secondary-900">
                      {event.title ?? "Untitled meeting"}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        DECISION_CLASSES[event.decision]
                      )}
                    >
                      {DECISION_LABELS[event.decision]}
                    </span>
                    {event.platform && (
                      <span className="text-xs text-secondary-400">
                        {PLATFORM_LABELS[event.platform] ?? event.platform}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-secondary-500">
                    {formatEventTime(event.startTime, event.endTime)} ·{" "}
                    {event.calendarEmail} · {event.attendees.length} attendee
                    {event.attendees.length === 1 ? "" : "s"}
                  </p>
                  {event.decisionReason && (
                    <p className="text-xs text-secondary-400">
                      {event.decisionReason}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-row items-center gap-2">
                  {event.meetingDbId && (
                    <Link
                      href={`/dashboard/calls/${event.meetingDbId}`}
                      className="text-sm text-primary-600 hover:underline"
                    >
                      View call
                    </Link>
                  )}
                  {(event.decision === "SCHEDULED" ||
                    event.decision === "RECORDING") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelEvent(event.id)}
                      disabled={cancellingEventId === event.id}
                      className="gap-1"
                    >
                      {cancellingEventId === event.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <X className="size-4" />
                      )}
                      {event.decision === "RECORDING"
                        ? "Stop recording"
                        : "Cancel bot"}
                    </Button>
                  )}
                  {event.decision === "COMPLETED" && (
                    <Check className="size-4 text-success-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <RecordingRuleModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRule(null);
        }}
        onSuccess={() => router.refresh()}
        mailboxes={mailboxes}
        rule={editingRule}
        workspaceDomain={config.workspaceDomain}
      />

      <AlertDialog
        open={Boolean(ruleToDelete)}
        onOpenChange={(open) => !open && setRuleToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              {ruleToDelete?.calendarEmail} will stop being recorded and any bot
              already scheduled for an upcoming meeting is cancelled. Existing
              recordings are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
