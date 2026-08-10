"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { CrmFilterBuilder } from "@/components/crm-table/filter-builder";
import { countActiveConditions } from "@/components/crm-table/utils";
import type { CrmFilterGroup } from "@/components/crm-table/types";
import {
  EMPTY_DYNAMIC_OPTIONS,
  toFilterColumns,
  type CrmFilterDynamicOptions,
} from "@/lib/crm/filters/columns";
import {
  previewSequenceEntryCriteria,
  previewSequenceExitCriteria,
} from "@/lib/actions/sequences";

/** Long enough that typing a value does not fire a query per keystroke. */
const PREVIEW_DEBOUNCE_MS = 600;

interface CrmCriteriaBuilderProps {
  mode: "entry" | "exit";
  value: CrmFilterGroup;
  onChange: (filters: CrmFilterGroup) => void;
  filterOptions?: CrmFilterDynamicOptions;
  sequenceId?: string | null;
  /** Entry mode only: exit criteria, which nobody is enrolled against. */
  excludeFilters?: CrmFilterGroup | null;
}

/**
 * Picks contacts by a nested AND/OR filter over their CRM record, their company
 * and their deals, for entering or leaving a sequence. The live count is the
 * point: criteria that quietly match nobody, or everybody, are the failure mode.
 */
export function CrmCriteriaBuilder({
  mode,
  value,
  onChange,
  filterOptions = EMPTY_DYNAMIC_OPTIONS,
  sequenceId = null,
  excludeFilters = null,
}: CrmCriteriaBuilderProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const columns = useMemo(
    () => toFilterColumns(filterOptions),
    [filterOptions]
  );

  const activeCount = countActiveConditions(value);
  // Serialised so the effect tracks the trees' contents, not their identity
  const filterKey = JSON.stringify(value);
  const excludeKey = JSON.stringify(excludeFilters);

  useEffect(() => {
    if (activeCount === 0) {
      setSummary(null);
      return;
    }

    let cancelled = false;
    setIsPreviewing(true);

    const timer = setTimeout(async () => {
      const filters = JSON.parse(filterKey) as CrmFilterGroup;

      const next =
        mode === "entry"
          ? await previewEntry(filters, sequenceId, excludeKey)
          : await previewExit(filters, sequenceId);

      if (cancelled) return;
      setSummary(next);
      setIsPreviewing(false);
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setIsPreviewing(false);
    };
  }, [mode, filterKey, excludeKey, activeCount, sequenceId]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <CrmFilterBuilder columns={columns} filters={value} onChange={onChange} />

      <p className="flex flex-row items-center gap-1.5 text-xs text-text-secondary">
        {activeCount === 0 ? (
          mode === "entry" ? (
            "No criteria yet, so nobody is enrolled automatically."
          ) : (
            "No criteria yet, so contacts only exit on reply, a booked meeting or an unsubscribe."
          )
        ) : isPreviewing ? (
          <>
            <Loader2 className="size-3 animate-spin" />
            Counting matching contacts
          </>
        ) : (
          <>
            <Users className="size-3" />
            <span>{summary ?? "Could not count matching contacts."}</span>
          </>
        )}
      </p>
    </div>
  );
}

async function previewEntry(
  filters: CrmFilterGroup,
  sequenceId: string | null,
  excludeKey: string
): Promise<string | null> {
  const result = await previewSequenceEntryCriteria(
    filters,
    sequenceId,
    JSON.parse(excludeKey) as CrmFilterGroup | null
  );
  if (!result.data) return null;

  const { matching, enrollable, sample } = result.data;
  const counts = `${matching.toLocaleString()} contact${matching === 1 ? "" : "s"} match${
    enrollable === matching ? "" : `, ${enrollable.toLocaleString()} enrollable now`
  }`;

  return sample.length > 0 ? `${counts} — ${sample.join(", ")}` : counts;
}

async function previewExit(
  filters: CrmFilterGroup,
  sequenceId: string | null
): Promise<string | null> {
  if (!sequenceId) {
    return "Checked against everyone in the sequence once it has contacts.";
  }

  const result = await previewSequenceExitCriteria(filters, sequenceId);
  if (!result.data) return null;

  const { matching, active } = result.data;
  if (active === 0) return "Nobody is active in this sequence yet.";

  return `${matching.toLocaleString()} of ${active.toLocaleString()} active contact${
    active === 1 ? "" : "s"
  } would exit now`;
}
