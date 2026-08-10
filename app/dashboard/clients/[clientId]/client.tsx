"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Users,
  Calendar,
  Clock,
  Mail,
  Video,
  ListTodo,
  AlertCircle,
  ChevronRight,
  Play,
  ExternalLink,
  Hash,
  ChevronDown,
  FileText,
  CheckCircle2,
  Sparkles,
  Bot,
  Trash2,
  Loader2,
  RefreshCw,
  CircleDollarSign,
  PhoneCall,
  UserX,
  XCircle,
} from "lucide-react";
import type { CompanyStatus } from "@prisma/client";
import { deleteTask, deleteActionItem, regenerateMeetingAnalysis } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
}

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: Date;
}

interface TaskData {
  id: string;
  name: string;
  status: string;
  priority: string;
  meetingId: string | null;
  meeting: {
    id: string;
    title: string;
  } | null;
  createdByJaroDevAutomation: boolean;
  createdBy: {
    id: string;
    email: string;
    firstName: string | null;
  } | null;
}

interface ActionItemData {
  id: string;
  name: string;
  status: string;
  priority: string;
  meetingId: string | null;
  meeting: {
    id: string;
    title: string;
  } | null;
  createdByJaroDevAutomation: boolean;
  createdBy: {
    id: string;
    email: string;
    firstName: string | null;
  } | null;
}

interface ClientData {
  id: string;
  name: string;
  status: CompanyStatus;
  slackPublicChannelId: string | null;
  slackInternalChannelId: string | null;
  createdAt: Date;
  updatedAt: Date;
  users: UserData[];
  meetings: MeetingData[];
  tasks: TaskData[];
  actionItems: ActionItemData[];
  _count: {
    users: number;
    tasks: number;
    actionItems: number;
    meetings: number;
  };
}

const clientStatusConfig: Record<CompanyStatus, { label: string; className: string; icon: typeof CircleDollarSign }> = {
  FORM_SUBMITTED: { label: "Form Submitted", className: "bg-secondary-100 text-secondary-700", icon: FileText },
  CALL_BOOKED: { label: "Call Booked", className: "bg-primary-100 text-primary-700", icon: Calendar },
  NO_SHOW: { label: "No Show", className: "bg-destructive-100 text-destructive-700", icon: XCircle },
  ATTENDED_SALES_CALL: { label: "Attended Sales Call", className: "bg-warning-100 text-warning-700", icon: PhoneCall },
  PURCHASED: { label: "Purchased", className: "bg-success-100 text-success-700", icon: CircleDollarSign },
  LOST: { label: "Lost", className: "bg-secondary-100 text-secondary-600", icon: XCircle },
  CHURNED: { label: "Churned", className: "bg-secondary-100 text-secondary-600", icon: UserX },
};

interface ClientDetailClientProps {
  client: ClientData;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  TODO: { label: "To Do", className: "bg-secondary-100 text-secondary-700" },
  IN_PROGRESS: { label: "In Progress", className: "bg-primary-100 text-primary-700" },
  BLOCKED: { label: "Blocked", className: "bg-warning-100 text-warning-700" },
  DONE: { label: "Done", className: "bg-success-100 text-success-700" },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "bg-secondary-100 text-secondary-600" },
  MEDIUM: { label: "Medium", className: "bg-primary-100 text-primary-600" },
  HIGH: { label: "High", className: "bg-warning-100 text-warning-600" },
  URGENT: { label: "Urgent", className: "bg-danger-100 text-danger-600" },
};

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
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

function getInitials(email: string, firstName?: string | null, lastName?: string | null) {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function getUserDisplayName(user: UserData) {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) {
    return user.firstName;
  }
  return user.email;
}

export function ClientDetailClient({ client }: ClientDetailClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [clientData, setClientData] = useState<ClientData>(client);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingData | null>(null);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [deletingActionItemId, setDeletingActionItemId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Sync clientData state with client prop when it changes (e.g., after router.refresh())
  useEffect(() => {
    setClientData(client);
    // Also update selectedMeeting if one is open (to show refreshed data)
    if (selectedMeeting) {
      const updatedMeeting = client.meetings.find((m) => m.id === selectedMeeting.id);
      if (updatedMeeting) {
        setSelectedMeeting(updatedMeeting);
      }
    }
  }, [client]);

  // Get tasks for a specific meeting
  const getTasksForMeeting = (meetingId: string) => {
    return clientData.tasks.filter((task) => task.meetingId === meetingId);
  };

  // Get action items for a specific meeting
  const getActionItemsForMeeting = (meetingId: string) => {
    return clientData.actionItems.filter((item) => item.meetingId === meetingId);
  };

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
      setClientData((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== taskId),
      }));
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
      setClientData((prev) => ({
        ...prev,
        actionItems: prev.actionItems.filter((a) => a.id !== actionItemId),
      }));
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
      
      // Refresh the page to get updated data (modal stays open, useEffect will update selectedMeeting)
      router.refresh();
    } catch (error) {
      console.error("Error regenerating analysis:", error);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Handle meeting URL parameter to open meeting modal
  useEffect(() => {
    const meetingId = searchParams?.get("meeting");
    if (meetingId) {
      const meeting = client.meetings.find((m) => m.id === meetingId);
      if (meeting) {
        setSelectedMeeting(meeting);
      }
      // Clear the query param after opening
      router.replace(`/dashboard/clients/${client.id}`, { scroll: false });
    }
  }, [searchParams, client.meetings, client.id, router]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/clients">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-100">
              <Building2 className="size-6 text-primary-600" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-secondary-900">{client.name}</h1>
                {(() => {
                  const statusInfo = clientStatusConfig[clientData.status];
                  const StatusIcon = statusInfo.icon;
                  return (
                    <Link
                      href="/dashboard/crm/deals"
                      title="Status follows this client's deals. Move the deal to change it."
                    >
                      <Badge className={`gap-1 ${statusInfo.className}`}>
                        <StatusIcon className="size-3" />
                        {statusInfo.label}
                      </Badge>
                    </Link>
                  );
                })()}
              </div>
              <p className="text-sm text-secondary-500">
                Client since {formatDate(client.createdAt)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {client.slackPublicChannelId && (
            <a
              href={`slack://channel?team=&id=${client.slackPublicChannelId}`}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-secondary-200 bg-background px-3 text-sm font-medium text-secondary-700 transition-colors hover:bg-secondary-100"
            >
              <Hash className="size-4" />
              Public Channel
            </a>
          )}
          {client.slackInternalChannelId && (
            <a
              href={`slack://channel?team=&id=${client.slackInternalChannelId}`}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-secondary-200 bg-background px-3 text-sm font-medium text-secondary-700 transition-colors hover:bg-secondary-100"
            >
              <Hash className="size-4" />
              Internal Channel
            </a>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary-100">
              <Users className="size-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">Team Members</p>
              <p className="text-2xl font-bold text-secondary-900">{client._count.users}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-success-100">
              <Video className="size-5 text-success-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">Meetings</p>
              <p className="text-2xl font-bold text-secondary-900">{client._count.meetings}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-warning-100">
              <ListTodo className="size-5 text-warning-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">Tasks</p>
              <p className="text-2xl font-bold text-secondary-900">{client._count.tasks}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-danger-100">
              <AlertCircle className="size-5 text-danger-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">Action Items</p>
              <p className="text-2xl font-bold text-secondary-900">{client._count.actionItems}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column - Meetings */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-secondary-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <Video className="size-5 text-secondary-600" />
                <h2 className="text-lg font-semibold text-secondary-900">Meeting Recordings</h2>
              </div>
              <Badge variant="secondary">{client.meetings.length} recordings</Badge>
            </div>
            
            {client.meetings.length === 0 ? (
              <div className="p-8 text-center">
                <Video className="mx-auto size-12 text-secondary-300" />
                <p className="mt-4 text-secondary-600">No meeting recordings yet</p>
                <p className="mt-1 text-sm text-secondary-500">
                  Meetings will appear here once call recordings are processed
                </p>
              </div>
            ) : (
              <div className="divide-y divide-secondary-100">
                {client.meetings.map((meeting) => (
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
                          {formatTime(meeting.startTime)} · {formatDuration(meeting.startTime, meeting.endTime)}
                        </span>
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
                          {meeting.participants.length} participant{meeting.participants.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-secondary-400" />
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column - Team */}
        <div>
          {/* Team Members */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-secondary-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <Users className="size-5 text-secondary-600" />
                <h2 className="text-lg font-semibold text-secondary-900">Team</h2>
              </div>
              <Link href="/dashboard/users">
                <Button variant="ghost" size="sm" className="text-xs">
                  Manage
                </Button>
              </Link>
            </div>
            
            {client.users.length === 0 ? (
              <div className="p-6 text-center">
                <Users className="mx-auto size-10 text-secondary-300" />
                <p className="mt-2 text-sm text-secondary-500">No team members yet</p>
              </div>
            ) : (
              <div className="divide-y divide-secondary-100">
                {client.users.map((user) => (
                  <div key={user.id} className="flex items-center gap-3 p-4">
                    <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-secondary-400 to-secondary-500 text-sm font-medium text-white">
                      {getInitials(user.email, user.firstName, user.lastName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-secondary-900">
                        {getUserDisplayName(user)}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-secondary-500">
                        <Mail className="size-3" />
                        <span className="truncate">{user.email}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {user.role}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Full Width - Active Tasks */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-secondary-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <ListTodo className="size-5 text-secondary-600" />
            <h2 className="text-lg font-semibold text-secondary-900">Active Tasks</h2>
          </div>
          <Link href="/dashboard/tasks">
            <Button variant="ghost" size="sm" className="text-xs">
              View All
            </Button>
          </Link>
        </div>
        
        {client.tasks.length === 0 ? (
          <div className="p-6 text-center">
            <ListTodo className="mx-auto size-10 text-secondary-300" />
            <p className="mt-2 text-sm text-secondary-500">No active tasks</p>
          </div>
        ) : (
          <div className="divide-y divide-secondary-100">
            {client.tasks.map((task) => (
              <div key={task.id} className="flex w-full items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium text-secondary-900">
                    {task.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {task.createdByJaroDevAutomation && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary-600">
                        <Bot className="size-3" />
                        Auto-created
                      </span>
                    )}
                    {task.meeting && (
                      <button
                        onClick={() => {
                          const meeting = client.meetings.find((m) => m.id === task.meeting?.id);
                          if (meeting) setSelectedMeeting(meeting);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-secondary-500 hover:text-primary-600"
                      >
                        <Video className="size-3" />
                        From: {task.meeting.title}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge className={`text-xs ${priorityConfig[task.priority]?.className || ""}`}>
                    {priorityConfig[task.priority]?.label || task.priority}
                  </Badge>
                  <Badge className={`text-xs ${statusConfig[task.status]?.className || ""}`}>
                    {statusConfig[task.status]?.label || task.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Full Width - Action Items */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-secondary-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 text-secondary-600" />
            <h2 className="text-lg font-semibold text-secondary-900">Action Items</h2>
          </div>
          <Link href="/dashboard/action-items">
            <Button variant="ghost" size="sm" className="text-xs">
              View All
            </Button>
          </Link>
        </div>
        
        {client.actionItems.length === 0 ? (
          <div className="p-6 text-center">
            <AlertCircle className="mx-auto size-10 text-secondary-300" />
            <p className="mt-2 text-sm text-secondary-500">No action items pending</p>
          </div>
        ) : (
          <div className="divide-y divide-secondary-100">
            {client.actionItems.map((item) => (
              <div key={item.id} className="flex w-full items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium text-secondary-900">
                    {item.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {item.createdByJaroDevAutomation && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary-600">
                        <Bot className="size-3" />
                        Auto-created
                      </span>
                    )}
                    {item.meeting && (
                      <button
                        onClick={() => {
                          const meeting = client.meetings.find((m) => m.id === item.meeting?.id);
                          if (meeting) setSelectedMeeting(meeting);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-secondary-500 hover:text-primary-600"
                      >
                        <Video className="size-3" />
                        From: {item.meeting.title}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge className={`text-xs ${priorityConfig[item.priority]?.className || ""}`}>
                    {priorityConfig[item.priority]?.label || item.priority}
                  </Badge>
                  <Badge className={`text-xs ${statusConfig[item.status]?.className || ""}`}>
                    {statusConfig[item.status]?.label || item.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Meeting Transcript Dialog */}
      <Dialog open={!!selectedMeeting} onOpenChange={(open) => {
        if (!open) {
          setSelectedMeeting(null);
          setIsTranscriptOpen(false);
        }
      }}>
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
                      {formatTime(selectedMeeting.startTime)} - {formatTime(selectedMeeting.endTime)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="size-4" />
                      {selectedMeeting.participants.length} participants
                    </span>
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
                {/* AI Summary */}
                {selectedMeeting.summary && (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <Sparkles className="size-4 text-primary-500" />
                      <h3 className="text-sm font-medium text-secondary-900">Meeting Summary</h3>
                      <Badge className="ml-auto bg-primary-50 text-xs text-primary-700">AI Generated</Badge>
                    </div>
                    <div className="rounded-lg border border-primary-100 bg-primary-50/50 p-4">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-secondary-700">
                        {selectedMeeting.summary}
                      </p>
                    </div>
                  </div>
                )}

                {/* Next Steps for Jaro.dev */}
                {(() => {
                  const meetingTasks = getTasksForMeeting(selectedMeeting.id);
                  if (meetingTasks.length === 0) return null;
                  return (
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <ListTodo className="size-4 text-warning-500" />
                        <h3 className="text-sm font-medium text-secondary-900">Next Steps for Jaro.dev</h3>
                        <Badge className="ml-auto bg-warning-50 text-xs text-warning-700">{meetingTasks.length} tasks</Badge>
                      </div>
                      <div className="space-y-2">
                        {meetingTasks.map((task) => (
                          <div key={task.id} className="rounded-lg border bg-warning-50/30 p-3">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-warning-600" />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-secondary-900">{task.name}</p>
                                <Badge className="mt-1 text-xs" variant="outline">
                                  {statusConfig[task.status]?.label || task.status}
                                </Badge>
                              </div>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                disabled={deletingTaskId === task.id}
                                className="shrink-0 rounded p-1 text-secondary-400 transition-colors hover:bg-secondary-100 hover:text-danger-500 disabled:opacity-50"
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
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Next Steps for Client */}
                {(() => {
                  const meetingActionItems = getActionItemsForMeeting(selectedMeeting.id);
                  if (meetingActionItems.length === 0) return null;
                  return (
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <AlertCircle className="size-4 text-danger-500" />
                        <h3 className="text-sm font-medium text-secondary-900">Next Steps for Client</h3>
                        <Badge className="ml-auto bg-danger-50 text-xs text-danger-700">{meetingActionItems.length} action items</Badge>
                      </div>
                      <div className="space-y-2">
                        {meetingActionItems.map((item) => (
                          <div key={item.id} className="rounded-lg border bg-danger-50/30 p-3">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-danger-600" />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-secondary-900">{item.name}</p>
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
                  );
                })()}

                {/* Participants */}
                <div>
                  <h3 className="mb-2 text-sm font-medium text-secondary-700">Participants</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedMeeting.participants.map((email) => (
                      <Badge key={email} variant="outline" className="text-xs">
                        {email}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Transcript - Collapsible */}
                <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex w-full items-center justify-between rounded-lg border bg-secondary-50 p-3 transition-colors hover:bg-secondary-100">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-secondary-500" />
                        <span className="text-sm font-medium text-secondary-700">Full Transcript</span>
                      </div>
                      <ChevronDown className={`size-4 text-secondary-500 transition-transform ${isTranscriptOpen ? "rotate-180" : ""}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 rounded-lg border bg-secondary-50 p-4">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-secondary-700">
                        {selectedMeeting.formattedTranscript || "No transcript available"}
                      </pre>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
