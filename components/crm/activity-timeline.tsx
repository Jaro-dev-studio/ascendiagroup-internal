"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatCrmDateTime } from "@/lib/utils";
import { ACTIVITY_TYPE_ICONS, ACTIVITY_TYPE_LABELS } from "@/constants/crm";
import { RsvpBadge } from "@/components/crm/rsvp-badge";
import type { AttendeeResponseStatus } from "@/lib/integrations/google-calendar";
import type { TimelineEntry } from "@/lib/fetchers/crm";

interface ActivityTimelineProps {
  entries: TimelineEntry[];
  emptyMessage?: string;
}

function formatActor(entry: TimelineEntry): string | null {
  if (!entry.actorUser) return null;
  const name = [entry.actorUser.firstName, entry.actorUser.lastName]
    .filter(Boolean)
    .join(" ");
  return name || entry.actorUser.email;
}

function readLeadResponseStatus(
  payload: unknown
): AttendeeResponseStatus | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const status =
    "leadResponseStatus" in payload ? payload.leadResponseStatus : null;
  if (
    status === "accepted" ||
    status === "declined" ||
    status === "tentative" ||
    status === "needsAction"
  ) {
    return status;
  }
  return null;
}

export function ActivityTimeline({
  entries,
  emptyMessage = "No activity recorded yet.",
}: ActivityTimelineProps) {
  if (entries.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-sm text-text-secondary">
          {emptyMessage}
        </p>
      </Card>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {entries.map((entry) => {
        const Icon = ACTIVITY_TYPE_ICONS[entry.type];
        const actor = formatActor(entry);
        const leadResponseStatus =
          entry.type === "MEETING_SCHEDULED"
            ? readLeadResponseStatus(entry.payload)
            : null;

        return (
          <li key={entry.id}>
            <Card className="p-4">
              <div className="flex flex-row items-start gap-3">
                <div className="mt-0.5 rounded-full bg-secondary-100 p-2">
                  <Icon className="size-4 text-secondary-600" aria-hidden />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-text-dark break-words text-sm font-medium">
                      {entry.title}
                    </p>
                    <div className="flex flex-row flex-wrap items-center gap-2">
                      <RsvpBadge
                        status={leadResponseStatus}
                        label="Guest"
                        className="w-fit shrink-0 text-xs"
                      />
                      <Badge variant="outline" className="w-fit shrink-0 text-xs">
                        {ACTIVITY_TYPE_LABELS[entry.type]}
                      </Badge>
                    </div>
                  </div>

                  {entry.body && (
                    <p className="whitespace-pre-wrap break-words text-sm text-text-secondary">
                      {entry.body}
                    </p>
                  )}

                  <div className="flex flex-row flex-wrap items-center gap-2 text-xs text-text-tertiary">
                    <time dateTime={new Date(entry.occurredAt).toISOString()}>
                      {formatCrmDateTime(entry.occurredAt)}
                    </time>
                    {actor && <span>&middot; {actor}</span>}
                    {entry.person?.fullName && (
                      <span>&middot; {entry.person.fullName}</span>
                    )}
                    {entry.meetingId && (
                      <Link
                        href={`/dashboard/calls?meeting=${entry.meetingId}`}
                        className={cn(
                          "text-primary-600 underline-offset-2 hover:underline"
                        )}
                      >
                        View call
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
