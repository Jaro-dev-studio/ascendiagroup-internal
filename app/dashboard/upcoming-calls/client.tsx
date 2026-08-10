"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Users,
  CalendarClock,
  ExternalLink,
  Building2,
  Mail,
  FileText,
  Briefcase,
  Timer,
  DollarSign,
  Smartphone,
  ChevronRight,
  AlertCircle,
  Sparkles,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { serviceLabel } from "@/constants/services";
import { RsvpBadge } from "@/components/crm/rsvp-badge";
import { cn } from "@/lib/utils";
import type { UpcomingCall } from "@/lib/fetchers";

interface UpcomingCallsClientProps {
  upcomingCalls: UpcomingCall[];
  error?: string;
  userEmail: string;
}

function getMeetLinkWithAuthUser(meetLink: string, userEmail: string): string {
  if (userEmail === "jaroslav.vorobey@gmail.com") {
    const url = new URL(meetLink);
    url.searchParams.set("authuser", "3");
    return url.toString();
  }
  return meetLink;
}

function formatDate(date: Date) {
  const now = new Date();
  const callDate = new Date(date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const callDay = new Date(callDate.getFullYear(), callDate.getMonth(), callDate.getDate());

  if (callDay.getTime() === today.getTime()) {
    return "Today";
  }
  if (callDay.getTime() === tomorrow.getTime()) {
    return "Tomorrow";
  }
  return callDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: callDate.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
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

function getInitials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

function isToday(date: Date) {
  const now = new Date();
  const callDate = new Date(date);
  return (
    callDate.getDate() === now.getDate() &&
    callDate.getMonth() === now.getMonth() &&
    callDate.getFullYear() === now.getFullYear()
  );
}

function getTimeUntil(date: Date) {
  const now = new Date();
  const diff = new Date(date).getTime() - now.getTime();
  
  // Past calls - show time ago
  if (diff < 0) {
    const minutesAgo = Math.floor(Math.abs(diff) / (1000 * 60));
    if (minutesAgo < 60) return `${minutesAgo}m ago`;
    const hoursAgo = Math.floor(minutesAgo / 60);
    return `${hoursAgo}h ago`;
  }
  
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 60) return `in ${minutes}m`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}

export function UpcomingCallsClient({ upcomingCalls, error, userEmail }: UpcomingCallsClientProps) {
  const [selectedCall, setSelectedCall] = useState<UpcomingCall | null>(null);

  // Separate today's calls from future calls
  const todaysCalls = upcomingCalls.filter((call) => isToday(call.startTime));
  const futureCalls = upcomingCalls.filter((call) => !isToday(call.startTime));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Upcoming Calls</h1>
        <p className="mt-1 text-secondary-500">
          View scheduled calls and meeting details
        </p>
      </div>

      {error && (
        <Card className="border-warning-200 bg-warning-50 p-4">
          <div className="flex items-center gap-2 text-warning-700">
            <AlertCircle className="size-5" />
            <p className="text-sm">{error}</p>
          </div>
        </Card>
      )}

      {/* Today's Calls */}
      {todaysCalls.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-secondary-100 bg-primary-50 px-6 py-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-primary-900">Today</h2>
            </div>
            <Badge className="bg-primary-100 text-primary-700">
              {todaysCalls.length} call{todaysCalls.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <div className="divide-y divide-secondary-100">
            {todaysCalls.map((call) => (
              <CallRow 
                key={call.id} 
                call={call} 
                onClick={() => setSelectedCall(call)}
                showTimeUntil
                userEmail={userEmail}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Future Calls */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-secondary-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Calendar className="size-5 text-secondary-600" />
            <h2 className="text-lg font-semibold text-secondary-900">
              {todaysCalls.length > 0 ? "Upcoming" : "Scheduled Calls"}
            </h2>
          </div>
          <Badge variant="secondary">
            {futureCalls.length} call{futureCalls.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {futureCalls.length === 0 && todaysCalls.length === 0 ? (
          <div className="p-8 text-center">
            <CalendarClock className="mx-auto size-12 text-secondary-300" />
            <p className="mt-4 text-secondary-600">No upcoming calls scheduled</p>
            <p className="mt-1 text-sm text-secondary-500">
              Calls from your calendar will appear here
            </p>
          </div>
        ) : futureCalls.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="mx-auto size-12 text-secondary-300" />
            <p className="mt-4 text-secondary-600">No more calls scheduled</p>
          </div>
        ) : (
          <div className="divide-y divide-secondary-100">
            {futureCalls.map((call) => (
              <CallRow 
                key={call.id} 
                call={call} 
                onClick={() => setSelectedCall(call)}
                userEmail={userEmail}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Call Details Dialog */}
      <Dialog
        open={!!selectedCall}
        onOpenChange={(open) => {
          if (!open) setSelectedCall(null);
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden">
          <DialogHeader className="shrink-0 border-b pb-4">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl">{selectedCall?.title}</DialogTitle>
                {selectedCall && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-4" />
                      {formatDate(selectedCall.startTime)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-4" />
                      {formatTime(selectedCall.startTime)} - {formatTime(selectedCall.endTime)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="size-4" />
                      {selectedCall.participants.length} participant
                      {selectedCall.participants.length !== 1 ? "s" : ""}
                    </span>
                    <RsvpBadge
                      status={selectedCall.leadResponseStatus}
                      label="Guest"
                      className="text-xs"
                    />
                  </div>
                )}
              </div>
              {selectedCall?.meetLink && (
                <Button
                  size="sm"
                  className="mt-2 sm:mt-0"
                  onClick={() => window.open(getMeetLinkWithAuthUser(selectedCall.meetLink!, userEmail), "_blank")}
                >
                  <Video className="mr-1.5 size-4" />
                  Join Meeting
                </Button>
              )}
            </div>
          </DialogHeader>

          {selectedCall && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-6 py-4">
                {/* Client Company */}
                {selectedCall.clientCompany && (
                  <div>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-secondary-900">
                      <Building2 className="size-4 text-primary-500" />
                    Client Company
                    </h3>
                    <Link
                      href={`/dashboard/clients/${selectedCall.clientCompany.id}`}
                      className="inline-flex items-center gap-2 rounded-lg border bg-secondary-50 px-4 py-2 text-sm font-medium text-secondary-900 transition-colors hover:bg-secondary-100"
                    >
                      {selectedCall.clientCompany.name}
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </div>
                )}

                {/* Form Submission Details */}
                {selectedCall.formSubmission && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-secondary-900">
                      <FileText className="size-4 text-primary-500" />
                    Lead Information
                    </h3>
                    <div className="rounded-lg border bg-secondary-50 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <InfoItem
                          icon={<Users className="size-4" />}
                          label="Name"
                          value={selectedCall.formSubmission.name}
                        />
                        <InfoItem
                          icon={<Mail className="size-4" />}
                          label="Email"
                          value={selectedCall.formSubmission.email}
                        />
                        {selectedCall.formSubmission.timeline && (
                          <InfoItem
                            icon={<Timer className="size-4" />}
                            label="Timeline"
                            value={selectedCall.formSubmission.timeline}
                          />
                        )}
                        {selectedCall.formSubmission.budget && (
                          <InfoItem
                            icon={<DollarSign className="size-4" />}
                            label="Budget"
                            value={selectedCall.formSubmission.budget}
                          />
                        )}
                        {selectedCall.formSubmission.companyHeadcount && (
                          <InfoItem
                            icon={<Building2 className="size-4" />}
                            label="Company Size"
                            value={selectedCall.formSubmission.companyHeadcount}
                          />
                        )}
                        {selectedCall.formSubmission.platform && (
                          <InfoItem
                            icon={<Smartphone className="size-4" />}
                            label="Platform"
                            value={selectedCall.formSubmission.platform}
                          />
                        )}
                        {selectedCall.formSubmission.productType && (
                          <InfoItem
                            icon={<Briefcase className="size-4" />}
                            label="Product Type"
                            value={selectedCall.formSubmission.productType}
                          />
                        )}
                      </div>
                      {selectedCall.formSubmission.servicesNeeded.length > 0 && (
                        <div className="mt-3 border-t pt-3">
                          <p className="mb-2 text-xs font-medium text-secondary-500">
                          Services Needed
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {selectedCall.formSubmission.servicesNeeded.map((service) => (
                              <Badge key={service} variant="outline" className="text-xs">
                                {service}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedCall.formSubmission.manualProcesses && (
                        <div className="mt-3 border-t pt-3">
                          <p className="mb-2 text-xs font-medium text-secondary-500">
                          Manual Processes
                          </p>
                          <p className="text-sm text-secondary-700">
                            {selectedCall.formSubmission.manualProcesses}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Automated company research */}
                {selectedCall.research?.summary && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-secondary-900">
                      <Sparkles className="size-4 text-primary-500" />
                      Company Research
                    </h3>
                    <div className="rounded-lg border bg-secondary-50 p-4">
                      <p className="whitespace-pre-wrap text-sm text-secondary-700">
                        {selectedCall.research.summary}
                      </p>

                      {selectedCall.research.opportunities.length > 0 && (
                        <div className="mt-3 border-t pt-3">
                          <p className="mb-2 text-xs font-medium text-secondary-500">
                            How We Could Help
                          </p>
                          <ul className="flex flex-col gap-2">
                            {selectedCall.research.opportunities.map((opportunity, index) => (
                              <li key={`${opportunity.title}-${index}`} className="text-sm text-secondary-700">
                                <span className="font-medium">{opportunity.title}</span>
                                <span className="text-secondary-500">
                                  {" "}
                                  · {serviceLabel(opportunity.service)}
                                </span>
                                <p className="text-secondary-600">{opportunity.proposal}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedCall.research.discoveryQuestions.length > 0 && (
                        <div className="mt-3 border-t pt-3">
                          <p className="mb-2 text-xs font-medium text-secondary-500">
                            Questions To Ask
                          </p>
                          <ul className="flex flex-col gap-1">
                            {selectedCall.research.discoveryQuestions.map((question, index) => (
                              <li key={`${question}-${index}`} className="text-sm text-secondary-700">
                                {question}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Link
                        href={`/dashboard/crm/companies/${selectedCall.research.companyId}`}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline"
                      >
                        Open {selectedCall.research.companyName}
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedCall.description && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-secondary-900">Description</h3>
                    <p className="whitespace-pre-wrap text-sm text-secondary-600">
                      {selectedCall.description}
                    </p>
                  </div>
                )}

                {/* Participants */}
                <div>
                  <h3 className="mb-2 text-sm font-medium text-secondary-700">Participants</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCall.participants.map((participant) => (
                      <Badge
                        key={participant.email}
                        variant="outline"
                        className={cn(
                          "max-w-full gap-1.5 py-1 text-xs font-medium",
                          participant.responseStatus ? "pr-1" : "",
                          participant.isOrganizer
                            ? "border-primary-300 bg-primary-50"
                            : ""
                        )}
                      >
                        <span className="min-w-0 break-all">
                          {participant.email}
                          {participant.isOrganizer && (
                            <span className="ml-1 text-primary-600">(organizer)</span>
                          )}
                        </span>
                        <RsvpBadge
                          status={participant.responseStatus}
                          className="shrink-0 border-transparent px-2 py-0 text-xs"
                        />
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* No enrichment data message */}
                {!selectedCall.clientCompany && !selectedCall.formSubmission && (
                  <div className="rounded-lg border border-dashed border-secondary-200 bg-secondary-50 p-4 text-center">
                    <p className="text-sm text-secondary-500">
                    No additional information available for this call.
                    </p>
                    <p className="mt-1 text-xs text-secondary-400">
                    Lead information will appear here when participants match form submissions.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CallRow({ 
  call, 
  onClick, 
  showTimeUntil = false,
  userEmail,
}: { 
  call: UpcomingCall; 
  onClick: () => void; 
  showTimeUntil?: boolean;
  userEmail: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-secondary-50"
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-sm">
        <CalendarClock className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 font-medium text-secondary-900">{call.title}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-secondary-500">
          <span className="flex items-center gap-1">
            <Calendar className="size-3.5" />
            {formatDate(call.startTime)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" />
            {formatTime(call.startTime)} · {formatDuration(call.startTime, call.endTime)}
          </span>
          {call.clientCompany && (
            <span className="flex items-center gap-1 text-primary-600">
              <Building2 className="size-3.5" />
              {call.clientCompany.name}
            </span>
          )}
          {!call.clientCompany && call.formSubmission && (
            <span className="flex items-center gap-1 text-secondary-600">
              <FileText className="size-3.5" />
              {call.formSubmission.name}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {call.participants.slice(0, 3).map((participant, i) => (
              <div
                key={participant.email}
                className="flex size-6 items-center justify-center rounded-full border-2 border-white bg-secondary-200 text-[10px] font-medium text-secondary-600"
                style={{ zIndex: 3 - i }}
                title={participant.email}
              >
                {getInitials(participant.email)}
              </div>
            ))}
            {call.participants.length > 3 && (
              <div className="flex size-6 items-center justify-center rounded-full border-2 border-white bg-secondary-100 text-[10px] font-medium text-secondary-500">
                +{call.participants.length - 3}
              </div>
            )}
          </div>
          <span className="text-xs text-secondary-400">
            {call.participants.length} participant
            {call.participants.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <RsvpBadge
          status={call.leadResponseStatus}
          label="Guest"
          className="text-xs"
        />
        {showTimeUntil && (
          <Badge className={`text-xs ${
            new Date(call.startTime).getTime() < Date.now()
              ? "bg-warning-100 text-warning-700"
              : "bg-primary-100 text-primary-700"
          }`}>
            {getTimeUntil(call.startTime)}
          </Badge>
        )}
        {call.formSubmission && (
          <Badge className="bg-success-50 text-xs text-success-700">Has Lead Info</Badge>
        )}
        {call.meetLink && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={(e) => {
              e.stopPropagation();
              window.open(getMeetLinkWithAuthUser(call.meetLink!, userEmail), "_blank");
            }}
          >
            <Video className="size-3.5" />
            Join
          </Button>
        )}
        <ChevronRight className="size-5 text-secondary-400" />
      </div>
    </button>
  );
}

function InfoItem({ 
  icon, 
  label, 
  value 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-secondary-400">{icon}</div>
      <div>
        <p className="text-xs text-secondary-500">{label}</p>
        <p className="text-sm font-medium text-secondary-900">{value}</p>
      </div>
    </div>
  );
}
