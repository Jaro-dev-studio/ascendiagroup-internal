import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { CrmFilterGroup } from "@/components/crm-table/types";
import {
  countActiveConditions,
  createConditionId,
  createFilterGroup,
  normaliseFilterGroup,
} from "@/components/crm-table/utils";
import { buildPersonWhere } from "@/lib/crm/filters/person-where";
import { getWorkspaceDomain } from "@/lib/integrations/google-auth";
import { enrollPerson } from "@/lib/crm/sequences/enroll";
import {
  buildExitWhere,
  resolveExitFilters,
} from "@/lib/crm/sequences/exit-criteria";

const LOG = "[Entry Criteria]";

/**
 * Ceiling per sequence per sweep. A criteria set that suddenly matches the
 * whole CRM then trickles in over several runs instead of enrolling thousands
 * of contacts at once, and the daily send limit still governs what goes out.
 */
const MAX_AUTO_ENROLLS_PER_RUN = 100;

/** Ceiling for the manual "enroll everyone matching" action. */
const MAX_MANUAL_ENROLLS = 500;

export interface SequenceCriteria {
  entryFilters: Prisma.JsonValue | null;
  autoEnrollEnabled: boolean;
  autoEnrollFormType: "REGULAR" | "BUSINESSOS" | null;
}

/**
 * The criteria to evaluate for a sequence. Sequences saved before entry
 * criteria existed fall back to their form-type auto-enrollment, so upgrading
 * does not silently stop enrolling inbound leads. Saving the sequence again
 * persists that fallback as real criteria.
 */
export function resolveEntryFilters(
  sequence: SequenceCriteria
): CrmFilterGroup | null {
  if (sequence.entryFilters) {
    const group = normaliseFilterGroup(sequence.entryFilters);
    if (countActiveConditions(group) > 0) return group;
  }

  return sequence.autoEnrollEnabled
    ? legacyFormFilters(sequence.autoEnrollFormType)
    : null;
}

/** The pre-criteria behaviour: "enrolled anyone who submitted this form". */
export function legacyFormFilters(
  formType: "REGULAR" | "BUSINESSOS" | null
): CrmFilterGroup {
  return createFilterGroup("and", [
    {
      id: createConditionId(),
      columnId: "formSubmission",
      operator: "is_any_of",
      value: formType ? [formType] : ["REGULAR", "BUSINESSOS"],
    },
  ]);
}

interface EnrollableWhereOptions {
  filters: unknown;
  sequenceId: string | null;
  now?: Date;
}

/**
 * Criteria plus the guards every enrollment needs: a contact we are allowed to
 * email, who is not already in this sequence. Exit criteria are applied
 * separately, by subtraction, because negating a whole filter tree in SQL drops
 * every row that has a null anywhere inside it.
 */
export function buildEnrollableWhere({
  filters,
  sequenceId,
  now = new Date(),
}: EnrollableWhereOptions): Prisma.PersonWhereInput | null {
  const criteria = buildPersonWhere(filters, now);
  if (!criteria) return null;

  const guards: Prisma.PersonWhereInput[] = [
    criteria,
    { email: { not: null } },
    { email: { not: { endsWith: `@${getWorkspaceDomain()}` } } },
    { doNotContact: false },
  ];

  if (sequenceId) {
    guards.push({ sequenceEnrollments: { none: { sequenceId } } });
  }

  return { AND: guards };
}

/** The subset of the given contacts that already match the exit criteria. */
async function findExitingIds(
  personIds: string[],
  exitFilters: unknown
): Promise<Set<string>> {
  const exitWhere = personIds.length > 0 ? buildExitWhere(exitFilters) : null;
  if (!exitWhere) return new Set();

  const exiting = await prisma.person.findMany({
    where: { AND: [{ id: { in: personIds } }, exitWhere] },
    select: { id: true },
  });

  return new Set(exiting.map((person) => person.id));
}

export interface EntryCriteriaPreview {
  /** Contacts matching the criteria, ignoring enrollment state. */
  matching: number;
  /** Of those, how many could be enrolled right now. */
  enrollable: number;
  /** A handful of names, so the count is recognisable rather than abstract. */
  sample: string[];
}

/**
 * Counts who a criteria set would pick up. Takes raw filters rather than a
 * sequence id so the settings modal can preview before anything is saved.
 */
export async function previewEntryCriteria(
  filters: unknown,
  sequenceId: string | null,
  exitFilters?: unknown
): Promise<{ data: EntryCriteriaPreview | null; error: string | null }> {
  try {
    const criteria = buildPersonWhere(filters);
    if (!criteria) {
      return { data: { matching: 0, enrollable: 0, sample: [] }, error: null };
    }

    console.log(`${LOG} previewing criteria...`);

    const enrollableWhere = buildEnrollableWhere({ filters, sequenceId });

    // Contacts the exit criteria already disqualify are subtracted rather than
    // negated into the query, which would drop every contact with a null field
    const exitWhere = exitFilters ? buildExitWhere(exitFilters) : null;
    const exitingWhere: Prisma.PersonWhereInput | null =
      enrollableWhere && exitWhere
        ? { AND: [enrollableWhere, exitWhere] }
        : null;

    const [matching, candidates, exiting, sample] = await Promise.all([
      prisma.person.count({ where: criteria }),
      enrollableWhere
        ? prisma.person.count({ where: enrollableWhere })
        : Promise.resolve(0),
      exitingWhere
        ? prisma.person.count({ where: exitingWhere })
        : Promise.resolve(0),
      prisma.person.findMany({
        where: enrollableWhere ?? criteria,
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { fullName: true, firstName: true, email: true },
      }),
    ]);

    const enrollable = candidates - exiting;

    console.log(
      `${LOG} criteria match ${matching} contact(s), ${enrollable} enrollable`
    );

    return {
      data: {
        matching,
        enrollable,
        sample: sample.map(
          (person) => person.fullName || person.firstName || person.email || ""
        ),
      },
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} preview failed:`, message);
    return { data: null, error: "Failed to preview entry criteria" };
  }
}

async function enrollMatching(
  sequenceId: string,
  filters: unknown,
  exitFilters: unknown,
  limit: number
): Promise<number> {
  const where = buildEnrollableWhere({ filters, sequenceId });
  if (!where) return 0;

  const people = await prisma.person.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true },
  });

  const exiting = await findExitingIds(
    people.map((person) => person.id),
    exitFilters
  );

  let enrolled = 0;
  for (const person of people) {
    if (exiting.has(person.id)) continue;

    const result = await enrollPerson(sequenceId, person.id);
    if (result.data?.status === "enrolled") enrolled += 1;
  }

  return enrolled;
}

/**
 * Sweep for the cron: every active sequence with auto-enrollment on picks up
 * the contacts that have started matching its criteria.
 */
export async function autoEnrollFromEntryCriteria(): Promise<{
  data: { enrolled: number; sequences: number } | null;
  error: string | null;
}> {
  try {
    const sequences = await prisma.sequence.findMany({
      where: { status: "ACTIVE", autoEnrollEnabled: true },
      select: {
        id: true,
        name: true,
        entryFilters: true,
        exitFilters: true,
        autoEnrollEnabled: true,
        autoEnrollFormType: true,
      },
    });

    if (sequences.length === 0) {
      return { data: { enrolled: 0, sequences: 0 }, error: null };
    }

    console.log(
      `${LOG} evaluating ${sequences.length} auto-enrolling sequence(s)...`
    );

    let enrolled = 0;

    for (const sequence of sequences) {
      const filters = resolveEntryFilters(sequence);
      if (!filters) continue;

      const added = await enrollMatching(
        sequence.id,
        filters,
        resolveExitFilters(sequence),
        MAX_AUTO_ENROLLS_PER_RUN
      );

      if (added > 0) {
        console.log(`${LOG} enrolled ${added} contact(s) in "${sequence.name}"`);
      }
      enrolled += added;
    }

    return { data: { enrolled, sequences: sequences.length }, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} sweep failed:`, message);
    return { data: null, error: message };
  }
}

/**
 * Backfill for a single sequence, triggered from the UI. Unlike the sweep this
 * runs whatever criteria are saved even when auto-enrollment is off, because
 * the user asked for it explicitly.
 */
export async function enrollMatchingContacts(sequenceId: string): Promise<{
  data: { enrolled: number } | null;
  error: string | null;
}> {
  try {
    const sequence = await prisma.sequence.findUnique({
      where: { id: sequenceId },
      select: {
        id: true,
        name: true,
        entryFilters: true,
        exitFilters: true,
        autoEnrollEnabled: true,
        autoEnrollFormType: true,
      },
    });

    if (!sequence) return { data: null, error: "Sequence not found" };

    const filters = resolveEntryFilters(sequence);
    if (!filters) {
      return { data: null, error: "This sequence has no entry criteria yet" };
    }

    console.log(`${LOG} backfilling "${sequence.name}"...`);
    const enrolled = await enrollMatching(
      sequence.id,
      filters,
      resolveExitFilters(sequence),
      MAX_MANUAL_ENROLLS
    );

    console.log(`${LOG} backfill enrolled ${enrolled} contact(s)`);
    return { data: { enrolled }, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} backfill failed:`, message);
    return { data: null, error: "Failed to enroll matching contacts" };
  }
}

/**
 * Immediate evaluation for one contact, so an inbound lead is enrolled on
 * submission rather than waiting for the next sweep.
 */
export async function autoEnrollPerson(
  personId: string
): Promise<{ data: { enrolled: number } | null; error: string | null }> {
  try {
    const sequences = await prisma.sequence.findMany({
      where: { status: "ACTIVE", autoEnrollEnabled: true },
      select: {
        id: true,
        name: true,
        entryFilters: true,
        exitFilters: true,
        autoEnrollEnabled: true,
        autoEnrollFormType: true,
      },
    });

    if (sequences.length === 0) {
      console.log(`${LOG} no auto-enrolling sequences`);
      return { data: { enrolled: 0 }, error: null };
    }

    let enrolled = 0;

    for (const sequence of sequences) {
      const filters = resolveEntryFilters(sequence);
      if (!filters) continue;

      const where = buildEnrollableWhere({ filters, sequenceId: sequence.id });
      if (!where) continue;

      const matches = await prisma.person.count({
        where: { AND: [{ id: personId }, where] },
      });
      if (matches === 0) continue;

      const exiting = await findExitingIds(
        [personId],
        resolveExitFilters(sequence)
      );
      if (exiting.has(personId)) continue;

      const result = await enrollPerson(sequence.id, personId);
      if (result.data?.status === "enrolled") enrolled += 1;
    }

    console.log(
      `${LOG} contact matched ${enrolled} of ${sequences.length} sequence(s)`
    );

    return { data: { enrolled }, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} contact evaluation failed:`, message);
    return { data: null, error: "Failed to auto-enroll contact" };
  }
}
