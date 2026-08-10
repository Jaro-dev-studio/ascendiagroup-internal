import {
  AlertTriangle,
  Ban,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Flame,
  Handshake,
  Inbox,
  Mail,
  MailOpen,
  MailX,
  MoveRight,
  Pencil,
  PlayCircle,
  Sparkles,
  StopCircle,
  Target,
  Upload,
  UserCheck,
  UserX,
  Video,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  CompanyStatus,
  CrmActivityType,
  CrmConnectionStrength,
  CrmLifecycleStage,
  DealBillingInterval,
  DealPricingType,
} from "@prisma/client";

export const LIFECYCLE_STAGE_LABELS: Record<CrmLifecycleStage, string> = {
  LEAD: "Lead",
  QUALIFIED: "Qualified",
  OPPORTUNITY: "Opportunity",
  CUSTOMER: "Customer",
  CHURNED: "Churned",
  DISQUALIFIED: "Disqualified",
};

export const LIFECYCLE_STAGE_ICONS: Record<CrmLifecycleStage, LucideIcon> = {
  LEAD: Sparkles,
  QUALIFIED: Target,
  OPPORTUNITY: Flame,
  CUSTOMER: Handshake,
  CHURNED: UserX,
  DISQUALIFIED: Ban,
};

export const LIFECYCLE_STAGE_ORDER: CrmLifecycleStage[] = [
  "LEAD",
  "QUALIFIED",
  "OPPORTUNITY",
  "CUSTOMER",
  "CHURNED",
  "DISQUALIFIED",
];

/** Tailwind classes for lifecycle badges, mapped to theme CSS variables. */
export const LIFECYCLE_STAGE_CLASSES: Record<CrmLifecycleStage, string> = {
  LEAD: "bg-secondary-100 text-secondary-700",
  QUALIFIED: "bg-primary-100 text-primary-700",
  OPPORTUNITY: "bg-accent-100 text-accent-700",
  CUSTOMER: "bg-success-100 text-success-700",
  CHURNED: "bg-warning-100 text-warning-700",
  DISQUALIFIED: "bg-danger-100 text-danger-700",
};

export const CONNECTION_STRENGTH_LABELS: Record<CrmConnectionStrength, string> =
  {
    STRONG: "Strong",
    MEDIUM: "Medium",
    WEAK: "Weak",
  };

/** Strongest first, so it reads as a scale in filters and sorts. */
export const CONNECTION_STRENGTH_ORDER: CrmConnectionStrength[] = [
  "STRONG",
  "MEDIUM",
  "WEAK",
];

export const CONNECTION_STRENGTH_CLASSES: Record<
  CrmConnectionStrength,
  string
> = {
  STRONG: "text-success-700",
  MEDIUM: "text-primary-700",
  WEAK: "text-text-secondary",
};

/** How many of the three bars the indicator fills. */
export const CONNECTION_STRENGTH_BARS: Record<CrmConnectionStrength, number> = {
  STRONG: 3,
  MEDIUM: 2,
  WEAK: 1,
};

/**
 * Company status is derived from the company's deals by
 * lib/crm/company-status.ts. LOST means no deal ever closed; CHURNED means one
 * did and the client later left.
 */
export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  FORM_SUBMITTED: "Form Submitted",
  CALL_BOOKED: "Call Booked",
  NO_SHOW: "No Show",
  ATTENDED_SALES_CALL: "Attended Sales Call",
  PURCHASED: "Purchased",
  LOST: "Lost",
  CHURNED: "Churned",
};

export const COMPANY_STATUS_ORDER: CompanyStatus[] = [
  "FORM_SUBMITTED",
  "CALL_BOOKED",
  "NO_SHOW",
  "ATTENDED_SALES_CALL",
  "PURCHASED",
  "LOST",
  "CHURNED",
];

export const COMPANY_STATUS_ICONS: Record<CompanyStatus, LucideIcon> = {
  FORM_SUBMITTED: FileText,
  CALL_BOOKED: CalendarCheck,
  NO_SHOW: UserX,
  ATTENDED_SALES_CALL: UserCheck,
  PURCHASED: CheckCircle2,
  LOST: XCircle,
  CHURNED: AlertTriangle,
};

export const COMPANY_STATUS_CLASSES: Record<CompanyStatus, string> = {
  FORM_SUBMITTED: "bg-secondary-100 text-secondary-700",
  CALL_BOOKED: "bg-primary-100 text-primary-700",
  NO_SHOW: "bg-warning-100 text-warning-700",
  ATTENDED_SALES_CALL: "bg-accent-100 text-accent-700",
  PURCHASED: "bg-success-100 text-success-700",
  LOST: "bg-secondary-100 text-secondary-600",
  CHURNED: "bg-danger-100 text-danger-700",
};

export const ACTIVITY_TYPE_LABELS: Record<CrmActivityType, string> = {
  NOTE: "Note",
  EMAIL_SENT: "Email sent",
  EMAIL_RECEIVED: "Email received",
  EMAIL_REPLIED: "Email reply",
  EMAIL_BOUNCED: "Email bounced",
  MEETING_SCHEDULED: "Meeting scheduled",
  MEETING_ACCEPTED: "Meeting accepted",
  MEETING_DECLINED: "Meeting declined",
  MEETING: "Meeting",
  STAGE_CHANGE: "Stage change",
  FORM_SUBMITTED: "Form submitted",
  SEQUENCE_ENROLLED: "Sequence enrolled",
  SEQUENCE_STEP_SENT: "Sequence step sent",
  SEQUENCE_STOPPED: "Sequence stopped",
  FIELD_CHANGED: "Field changed",
  TASK_CREATED: "Task created",
  IMPORTED: "Imported",
};

export const ACTIVITY_TYPE_ICONS: Record<CrmActivityType, LucideIcon> = {
  NOTE: FileText,
  EMAIL_SENT: Mail,
  EMAIL_RECEIVED: Inbox,
  EMAIL_REPLIED: MailOpen,
  EMAIL_BOUNCED: MailX,
  MEETING_SCHEDULED: CalendarCheck,
  MEETING_ACCEPTED: CheckCircle2,
  MEETING_DECLINED: XCircle,
  MEETING: Video,
  STAGE_CHANGE: MoveRight,
  FORM_SUBMITTED: ClipboardCheck,
  SEQUENCE_ENROLLED: PlayCircle,
  SEQUENCE_STEP_SENT: Mail,
  SEQUENCE_STOPPED: StopCircle,
  FIELD_CHANGED: Pencil,
  TASK_CREATED: CheckCircle2,
  IMPORTED: Upload,
};

export const LEAD_RESPONSE_STATUS_LABELS: Record<
  "accepted" | "declined" | "tentative" | "needsAction",
  string
> = {
  accepted: "Accepted",
  declined: "Declined",
  tentative: "Tentative",
  needsAction: "Pending",
};

export const LEAD_RESPONSE_STATUS_CLASSES: Record<
  "accepted" | "declined" | "tentative" | "needsAction",
  string
> = {
  accepted: "bg-success-100 text-success-700",
  declined: "bg-danger-100 text-danger-700",
  tentative: "bg-warning-100 text-warning-700",
  needsAction: "bg-warning-100 text-warning-700",
};

export const CURRENCY_OPTIONS = ["USD", "EUR", "GBP"] as const;

export function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

export const DEAL_PRICING_TYPE_OPTIONS: DealPricingType[] = [
  "PROJECT",
  "HOURLY",
  "RETAINER",
];

export const DEAL_PRICING_TYPE_LABELS: Record<DealPricingType, string> = {
  PROJECT: "Project",
  HOURLY: "Hourly",
  RETAINER: "Retainer",
};

export const DEAL_BILLING_INTERVAL_OPTIONS: DealBillingInterval[] = [
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL",
];

export const DEAL_BILLING_INTERVAL_LABELS: Record<DealBillingInterval, string> =
  {
    MONTHLY: "Monthly",
    QUARTERLY: "Quarterly",
    ANNUAL: "Annual",
  };

// How many billing periods a retainer covers unless the user says otherwise.
export const DEFAULT_RETAINER_PERIODS = 3;

export const DEFAULT_RETAINER_INTERVAL: DealBillingInterval = "MONTHLY";
