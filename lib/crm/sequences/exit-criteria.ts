import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { CrmFilterGroup } from "@/components/crm-table/types";
import {
  countActiveConditions,
  normaliseFilterGroup,
} from "@/components/crm-table/utils";
import { buildPersonWhere } from "@/lib/crm/filters/person-where";
import { logCrmActivity } from "@/lib/crm/activity";

const LOG = "[Exit Criteria]";

/** Guards a runaway filter from emptying a sequence in one pass. */
const MAX_EXITS_PER_RUN = 200;

interface SequenceExitCriteria {
  exitFilters: Prisma.JsonValue | null;
}

/** The saved exit criteria, or null when the sequence has none. */
export function resolveExitFilters(
  sequence: SequenceExitCriteria
): CrmFilterGroup | null {
  if (!sequence.exitFilters) return null;

  const group = normaliseFilterGroup(sequence.exitFilters);
  return countActiveConditions(group) > 0 ? group : null;
}

/** The contact-level clause for a sequence's exit criteria. */
export function buildExitWhere(
  filters: unknown,
  now: Date = new Date()
): Prisma.PersonWhereInput | null {
  return buildPersonWhere(filters, now);
}

/**
 * Stops everyone whose record now matches their sequence's exit criteria.
 * Runs before sending so a contact who has just been disqualified, or whose
 * deal has moved on, does not receive one last email.
 */
export async function stopEnrollmentsMatchingExitCriteria(): Promise<{
  data: { stopped: number } | null;
  error: string | null;
}> {
  try {
    // Filtered in memory rather than with a JSON where clause: there are only
    // ever a handful of sequences, and "no criteria" has several shapes.
    const all = await prisma.sequence.findMany({
      select: { id: true, name: true, exitFilters: true },
    });

    const sequences = all.filter((sequence) => resolveExitFilters(sequence));

    if (sequences.length === 0) {
      return { data: { stopped: 0 }, error: null };
    }

    console.log(
      `${LOG} checking ${sequences.length} sequence(s) with exit criteria...`
    );

    let stopped = 0;

    for (const sequence of sequences) {
      const exitWhere = buildExitWhere(resolveExitFilters(sequence));
      if (!exitWhere) continue;

      const enrollments = await prisma.sequenceEnrollment.findMany({
        where: {
          sequenceId: sequence.id,
          status: "ACTIVE",
          person: exitWhere,
        },
        take: MAX_EXITS_PER_RUN,
        select: { id: true, personId: true, person: { select: { companyId: true } } },
      });

      if (enrollments.length === 0) continue;

      await prisma.sequenceEnrollment.updateMany({
        where: { id: { in: enrollments.map((enrollment) => enrollment.id) } },
        data: {
          status: "STOPPED",
          stoppedReason: "Matched the sequence's exit criteria",
          nextSendAt: null,
        },
      });

      for (const enrollment of enrollments) {
        await logCrmActivity({
          type: "SEQUENCE_STOPPED",
          title: `Exited ${sequence.name}`,
          body: "Matched the sequence's exit criteria",
          personId: enrollment.personId,
          companyId: enrollment.person.companyId,
          payload: { sequenceId: sequence.id, reason: "exit_criteria" },
          externalId: `sequence-exit:${enrollment.id}`,
        });
      }

      console.log(
        `${LOG} stopped ${enrollments.length} enrollment(s) in "${sequence.name}"`
      );
      stopped += enrollments.length;
    }

    return { data: { stopped }, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} sweep failed:`, message);
    return { data: null, error: message };
  }
}

export interface ExitCriteriaPreview {
  /** Active contacts in this sequence that the criteria would stop now. */
  matching: number;
  /** How many are active in the sequence at all, for context. */
  active: number;
}

/**
 * Counts who the exit criteria would remove. Scoped to the sequence's own
 * active contacts, because that is the only population exit criteria act on.
 */
export async function previewExitCriteria(
  filters: unknown,
  sequenceId: string | null
): Promise<{ data: ExitCriteriaPreview | null; error: string | null }> {
  try {
    if (!sequenceId) return { data: { matching: 0, active: 0 }, error: null };

    const exitWhere = buildExitWhere(filters);
    if (!exitWhere) {
      const active = await prisma.sequenceEnrollment.count({
        where: { sequenceId, status: "ACTIVE" },
      });
      return { data: { matching: 0, active }, error: null };
    }

    console.log(`${LOG} previewing criteria for sequence ${sequenceId}...`);

    const [matching, active] = await Promise.all([
      prisma.sequenceEnrollment.count({
        where: { sequenceId, status: "ACTIVE", person: exitWhere },
      }),
      prisma.sequenceEnrollment.count({
        where: { sequenceId, status: "ACTIVE" },
      }),
    ]);

    console.log(`${LOG} ${matching} of ${active} active contact(s) would exit`);

    return { data: { matching, active }, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} preview failed:`, message);
    return { data: null, error: "Failed to preview exit criteria" };
  }
}
