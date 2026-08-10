"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Users,
  Video,
  Play,
  ExternalLink,
  ChevronDown,
  FileText,
  CheckCircle2,
  Sparkles,
  Trash2,
  Loader2,
  RefreshCw,
  Building2,
  ListTodo,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MailPlus,
  Copy,
  Send,
  Pencil,
  Check,
  Code,
  Github,
  Rocket,
} from "lucide-react";
import {
  deleteTask,
  deleteActionItem,
  regenerateMeetingAnalysis,
  queueProductBuildFromMeeting,
} from "@/lib/actions";
import {
  updateFollowupContent,
  sendFollowup,
  deleteFollowup,
} from "@/lib/actions/followups";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCrmDate } from "@/lib/utils";

interface TaskData {
  id: string;
  name: string;
  status: string;
  priority: string;
}

interface ActionItemData {
  id: string;
  name: string;
  status: string;
  priority: string;
}

interface BuildData {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  githubRepoUrl: string | null;
  vercelDeployUrl: string | null;
  cursorAgentUrl: string | null;
}

interface MeetingData {
  id: string;
  meetingId: string;
  callRecordingId: string;
  recordingUrl: string | null;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  participants: string[];
  formattedTranscript: string;
  summary: string | null;
  nextStepsJaroDev: string | null;
  nextStepsClient: string | null;
  createdAt: Date;
  clientCompany: {
    id: string;
    name: string;
    demos: BuildData[];
  } | null;
  tasks: TaskData[];
  actionItems: ActionItemData[];
}

interface CompanyOption {
  id: string;
  name: string;
}

interface FollowupTemplateData {
  id: string;
  name: string;
  prompt: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FollowupData {
  id: string;
  content: string;
  status: string;
  sentTo: string | null;
  sentAt: Date | null;
  createdAt: Date;
  template: {
    id: string;
    name: string;
  };
}

interface CallsClientProps {
  meetings: MeetingData[];
  followupTemplates: FollowupTemplateData[];
  meetingFollowups: Record<string, FollowupData[]>;
  clientCompanies: CompanyOption[];
  currentPage: number;
  pageSize: number;
  totalCount: number;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  TODO: { label: "To Do", className: "bg-secondary-100 text-secondary-700" },
  IN_PROGRESS: { label: "In Progress", className: "bg-primary-100 text-primary-700" },
  BLOCKED: { label: "Blocked", className: "bg-warning-100 text-warning-700" },
  DONE: { label: "Done", className: "bg-success-100 text-success-700" },
};

function formatDate(date: Date) {
  return formatCrmDate(date);
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start: Date, end: Date) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function getInitials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

const buildStatusConfig: Record<string, { label: string; className: string }> = {
  queued: { label: "Awaiting approval", className: "bg-warning-50 text-warning-700" },
  generating: { label: "Building", className: "bg-primary-50 text-primary-700" },
  deploying: { label: "Deploying", className: "bg-warning-50 text-warning-700" },
  ready: { label: "Ready", className: "bg-success-50 text-success-700" },
  failed: { label: "Failed", className: "bg-danger-50 text-danger-700" },
  pending: { label: "Pending", className: "bg-secondary-100 text-secondary-700" },
};

function getBuildStatusConfig(status: string) {
  return buildStatusConfig[status] || buildStatusConfig.pending;
}

export function CallsClient({
  meetings,
  followupTemplates,
  meetingFollowups,
  clientCompanies,
  currentPage,
  pageSize,
  totalCount,
}: CallsClientProps) {
  const router = useRouter();
  const [isPaginating, startPagination] = useTransition();
  const [meetingsData, setMeetingsData] = useState<MeetingData[]>(meetings);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingData | null>(null);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [deletingActionItemId, setDeletingActionItemId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Followup state
  const [followupsMap, setFollowupsMap] = useState<Record<string, FollowupData[]>>(meetingFollowups);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingFollowupId, setEditingFollowupId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [sendDialogFollowup, setSendDialogFollowup] = useState<FollowupData | null>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [deletingFollowupId, setDeletingFollowupId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Product build queueing
  const [isQueueingBuild, setIsQueueingBuild] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [isCompanyPickerOpen, setIsCompanyPickerOpen] = useState(false);
  const [pickedCompanyId, setPickedCompanyId] = useState("");

  // Handle task deletion
  const handleDeleteTask = async (taskId: string) => {
    setDeletingTaskId(taskId);
    try {
      const result = await deleteTask(taskId);
      if (result.error) {
        console.error("Failed to delete task:", result.error);
        return;
      }
      // Update local state
      setMeetingsData((prev) =>
        prev.map((meeting) => ({
          ...meeting,
          tasks: meeting.tasks.filter((t) => t.id !== taskId),
        }))
      );
      // Update selected meeting if open
      if (selectedMeeting) {
        setSelectedMeeting((prev) =>
          prev
            ? {
              ...prev,
              tasks: prev.tasks.filter((t) => t.id !== taskId),
            }
            : null
        );
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    } finally {
      setDeletingTaskId(null);
    }
  };

  // Handle action item deletion
  const handleDeleteActionItem = async (actionItemId: string) => {
    setDeletingActionItemId(actionItemId);
    try {
      const result = await deleteActionItem(actionItemId);
      if (result.error) {
        console.error("Failed to delete action item:", result.error);
        return;
      }
      // Update local state
      setMeetingsData((prev) =>
        prev.map((meeting) => ({
          ...meeting,
          actionItems: meeting.actionItems.filter((a) => a.id !== actionItemId),
        }))
      );
      // Update selected meeting if open
      if (selectedMeeting) {
        setSelectedMeeting((prev) =>
          prev
            ? {
              ...prev,
              actionItems: prev.actionItems.filter((a) => a.id !== actionItemId),
            }
            : null
        );
      }
    } catch (error) {
      console.error("Error deleting action item:", error);
    } finally {
      setDeletingActionItemId(null);
    }
  };

  // Handle regenerating AI analysis
  const handleRegenerateAnalysis = async () => {
    if (!selectedMeeting) return;

    setIsRegenerating(true);
    try {
      const result = await regenerateMeetingAnalysis(selectedMeeting.id);
      if (result.error) {
        console.error("Failed to regenerate analysis:", result.error);
        return;
      }

      // Refresh the page to get updated data
      router.refresh();
    } catch (error) {
      console.error("Error regenerating analysis:", error);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Queue a product build from this call
  const handleQueueBuild = async (clientCompanyId?: string) => {
    if (!selectedMeeting) return;

    setIsQueueingBuild(true);
    setBuildError(null);
    try {
      const result = await queueProductBuildFromMeeting(selectedMeeting.id, clientCompanyId);
      if (result.error || !result.data) {
        setBuildError(result.error || "Failed to queue build");
        return;
      }

      const { demoId, clientCompanyId: companyId, clientCompanyName } = result.data;
      const queuedBuild: BuildData = {
        id: demoId,
        name: `${clientCompanyName} - Product`,
        slug: null,
        status: "queued",
        githubRepoUrl: null,
        vercelDeployUrl: null,
        cursorAgentUrl: null,
      };

      const withQueuedBuild = (meeting: MeetingData): MeetingData => {
        const isSameCompany = meeting.clientCompany?.id === companyId;
        const isThisMeeting = meeting.id === selectedMeeting.id;
        if (!isSameCompany && !isThisMeeting) return meeting;

        return {
          ...meeting,
          clientCompany: {
            id: companyId,
            name: clientCompanyName,
            demos: [queuedBuild, ...(meeting.clientCompany?.demos || [])],
          },
        };
      };

      setMeetingsData((prev) => prev.map(withQueuedBuild));
      setSelectedMeeting((prev) => (prev ? withQueuedBuild(prev) : null));
      setIsCompanyPickerOpen(false);
      setPickedCompanyId("");
      router.refresh();
    } catch (error) {
      console.error("Error queueing build:", error);
      setBuildError("Failed to queue build");
    } finally {
      setIsQueueingBuild(false);
    }
  };

  const handleGenerateFollowup = async () => {
    if (!selectedMeeting || !selectedTemplateId) return;

    setIsGenerating(true);
    try {
      const res = await fetch("/api/followups/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: selectedMeeting.id, templateId: selectedTemplateId }),
      });
      const result = await res.json();
      if (result.error) {
        console.error("Failed to generate followup:", result.error);
        return;
      }
      if (result.data) {
        const template = followupTemplates.find((t) => t.id === selectedTemplateId);
        const newFollowup: FollowupData = {
          id: result.data.id,
          content: result.data.content,
          status: "DRAFT",
          sentTo: null,
          sentAt: null,
          createdAt: new Date(),
          template: {
            id: selectedTemplateId,
            name: template?.name || "Unknown",
          },
        };
        setFollowupsMap((prev) => ({
          ...prev,
          [selectedMeeting.id]: [newFollowup, ...(prev[selectedMeeting.id] || [])],
        }));
        setSelectedTemplateId("");
      }
    } catch (error) {
      console.error("Error generating followup:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartEdit = (followup: FollowupData) => {
    setEditingFollowupId(followup.id);
    setEditContent(followup.content);
  };

  const handleSaveEdit = async () => {
    if (!editingFollowupId || !selectedMeeting) return;

    setIsSavingEdit(true);
    try {
      const result = await updateFollowupContent(editingFollowupId, editContent);
      if (result.error) {
        console.error("Failed to save followup:", result.error);
        return;
      }
      setFollowupsMap((prev) => ({
        ...prev,
        [selectedMeeting.id]: (prev[selectedMeeting.id] || []).map((f) =>
          f.id === editingFollowupId ? { ...f, content: editContent } : f
        ),
      }));
      setEditingFollowupId(null);
    } catch (error) {
      console.error("Error saving followup:", error);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCopy = async (followup: FollowupData) => {
    try {
      await navigator.clipboard.writeText(followup.content);
      setCopiedId(followup.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleOpenSendDialog = (followup: FollowupData) => {
    setSendDialogFollowup(followup);
    const externalEmails = selectedMeeting?.participants.filter(
      (e) => !e.toLowerCase().endsWith("@jaro.dev")
    ) || [];
    setSendEmail(externalEmails[0] || "");
    setSendSubject(`Follow up: ${selectedMeeting?.title || ""}`);
  };

  const handleSendFollowup = async () => {
    if (!sendDialogFollowup || !sendEmail.trim() || !sendSubject.trim()) return;

    setIsSending(true);
    try {
      const result = await sendFollowup(sendDialogFollowup.id, sendEmail.trim(), sendSubject.trim());
      if (result.error) {
        console.error("Failed to send followup:", result.error);
        return;
      }
      if (selectedMeeting) {
        setFollowupsMap((prev) => ({
          ...prev,
          [selectedMeeting.id]: (prev[selectedMeeting.id] || []).map((f) =>
            f.id === sendDialogFollowup.id
              ? { ...f, status: "SENT", sentTo: sendEmail.trim(), sentAt: new Date() }
              : f
          ),
        }));
      }
      setSendDialogFollowup(null);
    } catch (error) {
      console.error("Error sending followup:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteFollowup = async (followupId: string) => {
    if (!selectedMeeting) return;

    setDeletingFollowupId(followupId);
    try {
      const result = await deleteFollowup(followupId);
      if (result.error) {
        console.error("Failed to delete followup:", result.error);
        return;
      }
      setFollowupsMap((prev) => ({
        ...prev,
        [selectedMeeting.id]: (prev[selectedMeeting.id] || []).filter(
          (f) => f.id !== followupId
        ),
      }));
    } catch (error) {
      console.error("Error deleting followup:", error);
    } finally {
      setDeletingFollowupId(null);
    }
  };

  const currentFollowups = selectedMeeting ? followupsMap[selectedMeeting.id] || [] : [];
  const existingBuild = selectedMeeting?.clientCompany?.demos[0] || null;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = (currentPage - 1) * pageSize + 1;
  const rangeEnd = rangeStart + meetingsData.length - 1;

  const goToPage = (page: number) => {
    startPagination(() => {
      router.push(page <= 1 ? "/dashboard/calls" : `/dashboard/calls?page=${page}`);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Call Recordings</h1>
        <p className="mt-1 text-secondary-500">
          View all call recordings and transcripts across clients
        </p>
      </div>

      {/* Calls List */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-secondary-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Video className="size-5 text-secondary-600" />
            <h2 className="text-lg font-semibold text-secondary-900">All Calls</h2>
          </div>
          <Badge variant="secondary">{totalCount} recordings</Badge>
        </div>

        {meetingsData.length === 0 ? (
          <div className="p-8 text-center">
            <Video className="mx-auto size-12 text-secondary-300" />
            {currentPage > 1 ? (
              <>
                <p className="mt-4 text-secondary-600">No recordings on this page</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(1)}
                  disabled={isPaginating}
                  className="mt-3"
                >
                  Back to first page
                </Button>
              </>
            ) : (
              <>
                <p className="mt-4 text-secondary-600">No call recordings yet</p>
                <p className="mt-1 text-sm text-secondary-500">
                  Calls will appear here once recordings are processed
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-secondary-100">
            {meetingsData.map((meeting) => (
              <button
                key={meeting.id}
                onClick={() => setSelectedMeeting(meeting)}
                className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-secondary-50"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-sm">
                  <Play className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-1 font-medium text-secondary-900">
                    {meeting.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-secondary-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3.5" />
                      {formatDate(meeting.startTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {formatTime(meeting.startTime)} ·{" "}
                      {formatDuration(meeting.startTime, meeting.endTime)}
                    </span>
                    {meeting.clientCompany && (
                      <Link
                        href={`/dashboard/clients/${meeting.clientCompany.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-primary-600 hover:text-primary-700"
                      >
                        <Building2 className="size-3.5" />
                        {meeting.clientCompany.name}
                      </Link>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                      {meeting.participants.slice(0, 3).map((email, i) => (
                        <div
                          key={email}
                          className="flex size-6 items-center justify-center rounded-full border-2 border-white bg-secondary-200 text-[10px] font-medium text-secondary-600"
                          style={{ zIndex: 3 - i }}
                          title={email}
                        >
                          {getInitials(email)}
                        </div>
                      ))}
                      {meeting.participants.length > 3 && (
                        <div className="flex size-6 items-center justify-center rounded-full border-2 border-white bg-secondary-100 text-[10px] font-medium text-secondary-500">
                          +{meeting.participants.length - 3}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-secondary-400">
                      {meeting.participants.length} participant
                      {meeting.participants.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {meeting.clientCompany?.demos[0] && (
                    <Badge
                      className={`text-xs ${getBuildStatusConfig(meeting.clientCompany.demos[0].status).className}`}
                    >
                      <Code className="mr-1 size-3" />
                      {getBuildStatusConfig(meeting.clientCompany.demos[0].status).label}
                    </Badge>
                  )}
                  {meeting.tasks.length > 0 && (
                    <Badge className="bg-warning-50 text-xs text-warning-700">
                      <ListTodo className="mr-1 size-3" />
                      {meeting.tasks.length}
                    </Badge>
                  )}
                  {meeting.actionItems.length > 0 && (
                    <Badge className="bg-danger-50 text-xs text-danger-700">
                      <AlertCircle className="mr-1 size-3" />
                      {meeting.actionItems.length}
                    </Badge>
                  )}
                  <ChevronRight className="size-5 text-secondary-400" />
                </div>
              </button>
            ))}
          </div>
        )}

        {totalPages > 1 && meetingsData.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-secondary-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-secondary-500">
              Showing {rangeStart}-{rangeEnd} of {totalCount} recordings
            </p>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1 || isPaginating}
                className="gap-1"
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <span className="flex items-center gap-2 text-sm text-secondary-500">
                {isPaginating && <Loader2 className="size-4 animate-spin" />}
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages || isPaginating}
                className="gap-1"
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Meeting Transcript Dialog */}
      <Dialog
        open={!!selectedMeeting}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMeeting(null);
            setIsTranscriptOpen(false);
            setEditingFollowupId(null);
            setSelectedTemplateId("");
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
          <DialogHeader className="shrink-0 border-b pb-4">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl">{selectedMeeting?.title}</DialogTitle>
                {selectedMeeting && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-4" />
                      {formatDate(selectedMeeting.startTime)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-4" />
                      {formatTime(selectedMeeting.startTime)} -{" "}
                      {formatTime(selectedMeeting.endTime)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="size-4" />
                      {selectedMeeting.participants.length} participants
                    </span>
                    {selectedMeeting.clientCompany && (
                      <Link
                        href={`/dashboard/clients/${selectedMeeting.clientCompany.id}`}
                        className="flex items-center gap-1.5 text-primary-600 hover:text-primary-700"
                      >
                        <Building2 className="size-4" />
                        {selectedMeeting.clientCompany.name}
                      </Link>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateAnalysis}
                  disabled={isRegenerating}
                  className="gap-2"
                >
                  {isRegenerating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  {isRegenerating ? "Analyzing..." : "Re-run AI"}
                </Button>
                {selectedMeeting?.recordingUrl && (
                  <a
                    href={selectedMeeting.recordingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-secondary-200 bg-background px-3 text-sm font-medium text-secondary-700 transition-colors hover:bg-secondary-100"
                  >
                    <ExternalLink className="size-4" />
                    Play recording
                  </a>
                )}
              </div>
            </div>
          </DialogHeader>

          {selectedMeeting && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-6 p-1">
                {/* Product Build */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Code className="size-4 text-primary-500" />
                    <h3 className="text-sm font-medium text-secondary-900">Product Build</h3>
                  </div>
                  {existingBuild ? (
                    <div className="rounded-lg border border-secondary-200 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-secondary-900">{existingBuild.name}</p>
                        <Badge className={`text-xs ${getBuildStatusConfig(existingBuild.status).className}`}>
                          {getBuildStatusConfig(existingBuild.status).label}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href="/dashboard/demos"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-secondary-200 px-3 text-xs font-medium text-secondary-700 transition-colors hover:bg-secondary-100"
                        >
                          <Rocket className="size-3.5" />
                          Open in Products
                        </Link>
                        {existingBuild.slug && existingBuild.status !== "queued" && (
                          <a
                            href={`/demo/${existingBuild.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-secondary-200 px-3 text-xs font-medium text-secondary-700 transition-colors hover:bg-secondary-100"
                          >
                            <ExternalLink className="size-3.5" />
                            View Product
                          </a>
                        )}
                        {existingBuild.githubRepoUrl && (
                          <a
                            href={existingBuild.githubRepoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-secondary-200 px-3 text-xs font-medium text-secondary-700 transition-colors hover:bg-secondary-100"
                          >
                            <Github className="size-3.5" />
                            GitHub
                          </a>
                        )}
                        {existingBuild.vercelDeployUrl && (
                          <a
                            href={existingBuild.vercelDeployUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-secondary-200 px-3 text-xs font-medium text-secondary-700 transition-colors hover:bg-secondary-100"
                          >
                            <ExternalLink className="size-3.5" />
                            Deployment
                          </a>
                        )}
                        {existingBuild.cursorAgentUrl && (
                          <a
                            href={existingBuild.cursorAgentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-secondary-200 px-3 text-xs font-medium text-secondary-700 transition-colors hover:bg-secondary-100"
                          >
                            <Code className="size-3.5" />
                            Cursor Agent
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-secondary-200 p-4">
                      <p className="text-sm text-secondary-600">
                        {selectedMeeting.formattedTranscript
                          ? "No build exists for this client yet. Queue one from this call's transcript and approve it on the Products page."
                          : "This call has no transcript, so a build can't be generated from it."}
                      </p>
                      {buildError && (
                        <p className="mt-2 text-sm text-danger-600">{buildError}</p>
                      )}
                      <Button
                        size="sm"
                        className="mt-3 gap-2"
                        disabled={isQueueingBuild || !selectedMeeting.formattedTranscript}
                        onClick={() => {
                          if (selectedMeeting.clientCompany) {
                            handleQueueBuild();
                            return;
                          }
                          setBuildError(null);
                          setPickedCompanyId("");
                          setIsCompanyPickerOpen(true);
                        }}
                      >
                        {isQueueingBuild ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Rocket className="size-4" />
                        )}
                        {isQueueingBuild ? "Queueing..." : "Queue Build"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* AI Summary */}
                {selectedMeeting.summary && (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <Sparkles className="size-4 text-primary-500" />
                      <h3 className="text-sm font-medium text-secondary-900">
                        Meeting Summary
                      </h3>
                      <Badge className="ml-auto bg-primary-50 text-xs text-primary-700">
                        AI Generated
                      </Badge>
                    </div>
                    <div className="rounded-lg border border-primary-100 bg-primary-50/50 p-4">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-secondary-700">
                        {selectedMeeting.summary}
                      </p>
                    </div>
                  </div>
                )}

                {/* Next Steps for Jaro.dev */}
                {selectedMeeting.tasks.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <ListTodo className="size-4 text-warning-500" />
                      <h3 className="text-sm font-medium text-secondary-900">
                        Next Steps for Jaro.dev
                      </h3>
                      <Badge className="ml-auto bg-warning-50 text-xs text-warning-700">
                        {selectedMeeting.tasks.length} tasks
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {selectedMeeting.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="rounded-lg border bg-warning-50/30 p-3"
                        >
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-warning-600" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-secondary-900">
                                {task.name}
                              </p>
                              <Badge className="mt-1 text-xs" variant="outline">
                                {statusConfig[task.status]?.label || task.status}
                              </Badge>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Link
                                href={`/dashboard/tasks?highlight=${task.id}`}
                                className="rounded p-1 text-secondary-400 transition-colors hover:bg-secondary-100 hover:text-primary-500"
                                title="Go to task"
                              >
                                <ExternalLink className="size-4" />
                              </Link>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                disabled={deletingTaskId === task.id}
                                className="rounded p-1 text-secondary-400 transition-colors hover:bg-secondary-100 hover:text-danger-500 disabled:opacity-50"
                                title="Delete task"
                              >
                                {deletingTaskId === task.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Next Steps for Client */}
                {selectedMeeting.actionItems.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <AlertCircle className="size-4 text-danger-500" />
                      <h3 className="text-sm font-medium text-secondary-900">
                        Next Steps for Client
                      </h3>
                      <Badge className="ml-auto bg-danger-50 text-xs text-danger-700">
                        {selectedMeeting.actionItems.length} action items
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {selectedMeeting.actionItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-lg border bg-danger-50/30 p-3"
                        >
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-danger-600" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-secondary-900">
                                {item.name}
                              </p>
                              <Badge className="mt-1 text-xs" variant="outline">
                                {statusConfig[item.status]?.label || item.status}
                              </Badge>
                            </div>
                            <button
                              onClick={() => handleDeleteActionItem(item.id)}
                              disabled={deletingActionItemId === item.id}
                              className="shrink-0 rounded p-1 text-secondary-400 transition-colors hover:bg-secondary-100 hover:text-danger-500 disabled:opacity-50"
                              title="Delete action item"
                            >
                              {deletingActionItemId === item.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Participants */}
                <div>
                  <h3 className="mb-2 text-sm font-medium text-secondary-700">
                    Participants
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedMeeting.participants.map((email) => (
                      <Badge key={email} variant="outline" className="text-xs">
                        {email}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Followups Section */}
                {selectedMeeting.formattedTranscript && (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <MailPlus className="size-4 text-primary-500" />
                      <h3 className="text-sm font-medium text-secondary-900">
                        Followups
                      </h3>
                      {currentFollowups.length > 0 && (
                        <Badge className="ml-auto bg-primary-50 text-xs text-primary-700">
                          {currentFollowups.length} generated
                        </Badge>
                      )}
                    </div>

                    {/* Generate new followup */}
                    {followupTemplates.length > 0 ? (
                      <div className="mb-4 flex items-center gap-2">
                        <Select
                          value={selectedTemplateId}
                          onValueChange={setSelectedTemplateId}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select a template..." />
                          </SelectTrigger>
                          <SelectContent>
                            {followupTemplates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={handleGenerateFollowup}
                          disabled={!selectedTemplateId || isGenerating}
                          size="sm"
                          className="shrink-0 gap-2"
                        >
                          {isGenerating ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Sparkles className="size-4" />
                          )}
                          {isGenerating ? "Generating..." : "Generate"}
                        </Button>
                      </div>
                    ) : (
                      <div className="mb-4 rounded-lg border border-dashed border-secondary-300 p-3 text-center">
                        <p className="text-sm text-secondary-500">
                          No followup templates yet.{" "}
                          <a
                            href="/dashboard/settings/followup-templates"
                            className="text-primary-600 hover:text-primary-700"
                          >
                            Create one
                          </a>{" "}
                          to start generating followups.
                        </p>
                      </div>
                    )}

                    {/* Followups list */}
                    {currentFollowups.length > 0 && (
                      <div className="space-y-3">
                        {currentFollowups.map((followup) => (
                          <div
                            key={followup.id}
                            className="rounded-lg border bg-background p-4"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {followup.template.name}
                                </Badge>
                                <Badge
                                  className={
                                    followup.status === "SENT"
                                      ? "bg-success-50 text-xs text-success-700"
                                      : "bg-warning-50 text-xs text-warning-700"
                                  }
                                >
                                  {followup.status === "SENT" ? "Sent" : "Draft"}
                                </Badge>
                                {followup.sentTo && (
                                  <span className="text-xs text-secondary-500">
                                    to {followup.sentTo}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-secondary-400">
                                {formatCrmDate(followup.createdAt)}
                              </span>
                            </div>

                            {editingFollowupId === followup.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  rows={10}
                                  className="text-sm"
                                />
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={handleSaveEdit}
                                    disabled={isSavingEdit}
                                    className="gap-1"
                                  >
                                    {isSavingEdit ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      <Check className="size-3" />
                                    )}
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingFollowupId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="max-h-40 overflow-y-auto rounded bg-secondary-50 p-3">
                                  <p className="whitespace-pre-wrap text-sm text-secondary-700">
                                    {followup.content}
                                  </p>
                                </div>
                                <div className="mt-2 flex items-center gap-1">
                                  <button
                                    onClick={() => handleStartEdit(followup)}
                                    className="rounded p-1.5 text-secondary-400 transition-colors hover:bg-secondary-100 hover:text-primary-500"
                                    title="Edit"
                                  >
                                    <Pencil className="size-4" />
                                  </button>
                                  <button
                                    onClick={() => handleCopy(followup)}
                                    className="rounded p-1.5 text-secondary-400 transition-colors hover:bg-secondary-100 hover:text-primary-500"
                                    title="Copy to clipboard"
                                  >
                                    {copiedId === followup.id ? (
                                      <Check className="size-4 text-success-500" />
                                    ) : (
                                      <Copy className="size-4" />
                                    )}
                                  </button>
                                  {followup.status !== "SENT" && (
                                    <button
                                      onClick={() => handleOpenSendDialog(followup)}
                                      className="rounded p-1.5 text-secondary-400 transition-colors hover:bg-secondary-100 hover:text-primary-500"
                                      title="Send as email"
                                    >
                                      <Send className="size-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteFollowup(followup.id)}
                                    disabled={deletingFollowupId === followup.id}
                                    className="rounded p-1.5 text-secondary-400 transition-colors hover:bg-secondary-100 hover:text-danger-500 disabled:opacity-50"
                                    title="Delete"
                                  >
                                    {deletingFollowupId === followup.id ? (
                                      <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="size-4" />
                                    )}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Transcript - Collapsible */}
                <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex w-full items-center justify-between rounded-lg border bg-secondary-50 p-3 transition-colors hover:bg-secondary-100">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-secondary-500" />
                        <span className="text-sm font-medium text-secondary-700">
                          Full Transcript
                        </span>
                      </div>
                      <ChevronDown
                        className={`size-4 text-secondary-500 transition-transform ${
                          isTranscriptOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 rounded-lg border bg-secondary-50 p-4">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-secondary-700">
                        {selectedMeeting.formattedTranscript ||
                          "No transcript available"}
                      </pre>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send Followup Dialog */}
      <Dialog
        open={!!sendDialogFollowup}
        onOpenChange={(open) => {
          if (!open) setSendDialogFollowup(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Followup Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="send-to">Recipient</Label>
              <Input
                id="send-to"
                type="email"
                placeholder="email@example.com"
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="send-subject">Subject</Label>
              <Input
                id="send-subject"
                placeholder="Email subject..."
                value={sendSubject}
                onChange={(e) => setSendSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="max-h-40 overflow-y-auto rounded-lg border bg-secondary-50 p-3">
                <p className="whitespace-pre-wrap text-sm text-secondary-700">
                  {sendDialogFollowup?.content}
                </p>
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <Button
                onClick={handleSendFollowup}
                disabled={isSending || !sendEmail.trim() || !sendSubject.trim()}
                className="gap-2"
              >
                {isSending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {isSending ? "Sending..." : "Send Email"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSendDialogFollowup(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pick a client company for calls that aren't linked to one */}
      <Dialog
        open={isCompanyPickerOpen}
        onOpenChange={(open) => {
          if (!open && !isQueueingBuild) {
            setIsCompanyPickerOpen(false);
            setPickedCompanyId("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Which client is this call for?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-secondary-600">
              This call isn&apos;t linked to a client company yet. Pick one so the build can use
              their branding and website. The call will be linked to them too.
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="build-company">Client company</Label>
              <Select
                value={pickedCompanyId}
                onValueChange={setPickedCompanyId}
                disabled={isQueueingBuild}
              >
                <SelectTrigger id="build-company">
                  <SelectValue placeholder="Select a client company" />
                </SelectTrigger>
                <SelectContent>
                  {clientCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {buildError && <p className="text-sm text-danger-600">{buildError}</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => handleQueueBuild(pickedCompanyId)}
                disabled={isQueueingBuild || !pickedCompanyId}
                className="flex-1 gap-2"
              >
                {isQueueingBuild ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Rocket className="size-4" />
                )}
                {isQueueingBuild ? "Queueing..." : "Queue Build"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsCompanyPickerOpen(false)}
                disabled={isQueueingBuild}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
