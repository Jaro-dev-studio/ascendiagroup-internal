import { Badge } from "@/components/ui/badge";
import {
  LEAD_RESPONSE_STATUS_CLASSES,
  LEAD_RESPONSE_STATUS_LABELS,
} from "@/constants/crm";
import type { AttendeeResponseStatus } from "@/lib/integrations/google-calendar";
import { cn } from "@/lib/utils";

interface RsvpBadgeProps {
  status: AttendeeResponseStatus | null;
  /**
   * Who the RSVP belongs to. Set this when the badge sits away from the person
   * it describes, so a bare "Accepted" cannot be read as belonging to a
   * neighbouring pill.
   */
  label?: string;
  className?: string;
}

/**
 * How a guest answered the invite. Renders nothing when we have no answer on
 * record, so a booking that has not synced yet stays quiet instead of implying
 * the guest ignored it.
 */
export function RsvpBadge({ status, label, className }: RsvpBadgeProps) {
  if (!status) return null;

  return (
    <Badge
      className={cn(
        "font-medium",
        LEAD_RESPONSE_STATUS_CLASSES[status],
        className
      )}
    >
      {label ? `${label}: ` : ""}
      {LEAD_RESPONSE_STATUS_LABELS[status]}
    </Badge>
  );
}
