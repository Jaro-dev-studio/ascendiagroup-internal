import {
  Ban,
  CheckCircle2,
  CircleSlash,
  MailWarning,
  MessageSquare,
  Pause,
  Play,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { EnrollmentStatus, SequenceStatus } from "@prisma/client";

export const SEQUENCE_STATUS_LABELS: Record<SequenceStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  PAUSED: "Paused",
  ARCHIVED: "Archived",
};

export const SEQUENCE_STATUS_CLASSES: Record<SequenceStatus, string> = {
  DRAFT: "bg-secondary-100 text-secondary-700",
  ACTIVE: "bg-success-100 text-success-700",
  PAUSED: "bg-warning-100 text-warning-700",
  ARCHIVED: "bg-secondary-100 text-secondary-500",
};

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  REPLIED: "Replied",
  BOUNCED: "Bounced",
  UNSUBSCRIBED: "Unsubscribed",
  STOPPED: "Stopped",
  FAILED: "Failed",
};

export const ENROLLMENT_STATUS_CLASSES: Record<EnrollmentStatus, string> = {
  ACTIVE: "bg-primary-100 text-primary-700",
  PAUSED: "bg-warning-100 text-warning-700",
  COMPLETED: "bg-secondary-100 text-secondary-700",
  REPLIED: "bg-success-100 text-success-700",
  BOUNCED: "bg-danger-100 text-danger-700",
  UNSUBSCRIBED: "bg-danger-100 text-danger-700",
  STOPPED: "bg-secondary-100 text-secondary-500",
  FAILED: "bg-danger-100 text-danger-700",
};

export const ENROLLMENT_STATUS_ICONS: Record<EnrollmentStatus, LucideIcon> = {
  ACTIVE: Play,
  PAUSED: Pause,
  COMPLETED: CheckCircle2,
  REPLIED: MessageSquare,
  BOUNCED: MailWarning,
  UNSUBSCRIBED: Ban,
  STOPPED: CircleSlash,
  FAILED: XCircle,
};

export const ENROLLMENT_STATUS_ORDER: EnrollmentStatus[] = [
  "ACTIVE",
  "PAUSED",
  "REPLIED",
  "COMPLETED",
  "BOUNCED",
  "UNSUBSCRIBED",
  "STOPPED",
  "FAILED",
];

export const SEQUENCE_TIMEZONES = [
  "Europe/London",
  "Europe/Amsterdam",
  "Europe/Berlin",
  "Europe/Lisbon",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
] as const;

/** Variables the step editor offers, mirroring lib/crm/sequences/render.ts. */
export const SEQUENCE_VARIABLES: Array<{ token: string; description: string }> = [
  { token: "{{firstName}}", description: "Contact's first name" },
  { token: "{{lastName}}", description: "Contact's last name" },
  { token: "{{fullName}}", description: "Contact's full name" },
  { token: "{{email}}", description: "Contact's email address" },
  { token: "{{jobTitle}}", description: "Contact's job title" },
  { token: "{{companyName}}", description: "Contact's company" },
  { token: "{{senderName}}", description: "Your from name" },
  { token: "{{senderFirstName}}", description: "Your first name" },
];

export function formatStepDelay(delayDays: number, delayHours: number): string {
  if (delayDays === 0 && delayHours === 0) return "Immediately";

  const parts: string[] = [];
  if (delayDays > 0) parts.push(`${delayDays} day${delayDays === 1 ? "" : "s"}`);
  if (delayHours > 0) {
    parts.push(`${delayHours} hour${delayHours === 1 ? "" : "s"}`);
  }
  return `After ${parts.join(" ")}`;
}
