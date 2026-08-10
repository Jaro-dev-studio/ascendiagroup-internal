import { cn } from "@/lib/utils";
import {
  CONNECTION_STRENGTH_BARS,
  CONNECTION_STRENGTH_CLASSES,
  CONNECTION_STRENGTH_LABELS,
} from "@/constants/crm";
import { formatAbsoluteDate, formatRelativeTime } from "@/components/crm-table";
import type { CrmConnectionStrength } from "@prisma/client";

/**
 * Shared cells for the denormalised engagement columns. A null value means we
 * have no recorded interaction, which reads as "No contact" rather than blank.
 */

export function NoContact() {
  return <span className="text-text-tertiary">No contact</span>;
}

export function ConnectionStrengthCell({
  strength,
}: {
  strength: CrmConnectionStrength | null;
}) {
  if (!strength) return <NoContact />;

  const filled = CONNECTION_STRENGTH_BARS[strength];

  return (
    <span
      className={cn(
        "flex items-center gap-1.5",
        CONNECTION_STRENGTH_CLASSES[strength]
      )}
      title={`${CONNECTION_STRENGTH_LABELS[strength]} connection`}
    >
      <span className="flex items-end gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={cn(
              "w-0.5 rounded-sm bg-current",
              bar === 1 && "h-1.5",
              bar === 2 && "h-2.5",
              bar === 3 && "h-3.5",
              bar > filled && "opacity-25"
            )}
          />
        ))}
      </span>
      <span className="truncate">{CONNECTION_STRENGTH_LABELS[strength]}</span>
    </span>
  );
}

export function RelativeDateCell({ value }: { value: Date | null }) {
  if (!value) return <NoContact />;

  return (
    <span className="block truncate" title={formatRelativeTime(value)}>
      {formatAbsoluteDate(value)}
    </span>
  );
}

export function NextEventCell({
  at,
  title,
}: {
  at: Date | null;
  title: string | null;
}) {
  if (!at) return <NoContact />;

  const absolute = formatAbsoluteDate(at);

  return (
    <span
      className="block truncate"
      title={title ? `${title} — ${formatRelativeTime(at)}` : formatRelativeTime(at)}
    >
      {absolute}
    </span>
  );
}
