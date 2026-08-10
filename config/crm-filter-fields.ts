import type { Prisma } from "@prisma/client";
import type {
  CrmColumnType,
  CrmFilterOperator,
  CrmFilterOption,
} from "@/components/crm-table/types";
import { getOperatorsForType } from "@/components/crm-table/utils";
import {
  COMPANY_STATUS_LABELS,
  COMPANY_STATUS_ORDER,
  CONNECTION_STRENGTH_LABELS,
  CONNECTION_STRENGTH_ORDER,
  LIFECYCLE_STAGE_LABELS,
  LIFECYCLE_STAGE_ORDER,
} from "@/constants/crm";

/**
 * Filterable fields for contact-rooted queries, used by sequence entry
 * criteria. Each field owns both its presentation (label, type, options) and
 * its translation to a Prisma clause, so there is one place to add a field.
 *
 * Company and deal fields are reached through the contact: "deal stage is
 * Proposal" means the contact, or the company they belong to, has such a deal.
 */

/** Options that can only be resolved against the database at render time. */
export type CrmFilterOptionSource = "owners" | "pipelineStages" | "industries";

export type CrmFilterFieldGroup = "Contact" | "Company" | "Deal" | "Activity";

export interface CrmFilterClause {
  operator: CrmFilterOperator;
  /** Chosen option values, for select fields. */
  values: string[];
  /** Raw entry for text, number and date fields. */
  value: string;
  value2: string;
  now: Date;
}

export interface CrmPersonFilterField {
  id: string;
  label: string;
  group: CrmFilterFieldGroup;
  type: CrmColumnType;
  options?: CrmFilterOption[];
  optionsSource?: CrmFilterOptionSource;
  /** Narrows the offered operators when the type's defaults do not all apply. */
  operators?: CrmFilterOperator[];
  /** Null means the clause is incomplete and should be ignored. */
  toWhere: (clause: CrmFilterClause) => Prisma.PersonWhereInput | null;
}

const DAY_MS = 86_400_000;

const YES_NO_OPTIONS: CrmFilterOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

/** Option value standing in for "no owner set" in the owner pickers. */
export const UNASSIGNED_OWNER = "unassigned";

const EMPTINESS_OPERATORS: CrmFilterOperator[] = ["is_empty", "is_not_empty"];

/** Membership only: the field is a computed yes/no or a relation test. */
const MEMBERSHIP_OPERATORS: CrmFilterOperator[] = ["is_any_of", "is_none_of"];

/** Columns the database declares NOT NULL cannot be asked about emptiness. */
function withoutEmptiness(type: CrmColumnType): CrmFilterOperator[] {
  return getOperatorsForType(type).filter(
    (operator) => !EMPTINESS_OPERATORS.includes(operator)
  );
}

// ============================================
// Clause helpers
// ============================================

/**
 * Wraps a leaf filter in its relation path, e.g. ["company", "industry"] gives
 * `{ company: { industry: leaf } }`. Leaves are untyped because Prisma's enum
 * filters expect enum members while filter values arrive as strings.
 */
function nest(path: string[], leaf: unknown): Prisma.PersonWhereInput {
  let current: unknown = leaf;
  for (let index = path.length - 1; index >= 0; index -= 1) {
    current = { [path[index]]: current };
  }
  return current as Prisma.PersonWhereInput;
}

function negate(where: Prisma.PersonWhereInput): Prisma.PersonWhereInput {
  return { NOT: where };
}

/**
 * Everything that counts as "no value here": a missing relation, a null, and
 * for text, the empty string. Returns null when the column can never be empty,
 * which only happens for a NOT NULL column reached without a relation.
 */
function missingWhere(
  path: string[],
  type: CrmColumnType,
  nullable: boolean
): Prisma.PersonWhereInput | null {
  const clauses: Prisma.PersonWhereInput[] = [];

  // A contact with no company has no company field values either
  if (path.length > 1) clauses.push(nest(path.slice(0, -1), null));

  if (nullable) {
    clauses.push(nest(path, { equals: null }));
    if (type === "text") clauses.push(nest(path, { equals: "" }));
  }

  if (clauses.length === 0) return null;
  return clauses.length === 1 ? clauses[0] : { OR: clauses };
}

/**
 * Negation that keeps records with no value. Postgres drops NULL rows from a
 * plain NOT, so "industry is not SaaS" would otherwise hide every company whose
 * industry nobody has filled in, which is never what the filter meant.
 */
function negateKeepingEmpty(
  where: Prisma.PersonWhereInput,
  missing: Prisma.PersonWhereInput | null
): Prisma.PersonWhereInput {
  return missing ? { OR: [negate(where), missing] } : negate(where);
}

function startOfDay(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Shared by every date field, including those inside relations. */
export function buildDateFilter(
  clause: CrmFilterClause
): Record<string, Date> | null {
  const { operator, value, value2, now } = clause;

  switch (operator) {
    case "on": {
      const from = startOfDay(value);
      if (!from) return null;
      return { gte: from, lt: new Date(from.getTime() + DAY_MS) };
    }
    case "before": {
      const from = startOfDay(value);
      return from ? { lt: from } : null;
    }
    case "after": {
      const from = startOfDay(value);
      return from ? { gte: new Date(from.getTime() + DAY_MS) } : null;
    }
    case "between": {
      const from = startOfDay(value);
      const to = startOfDay(value2);
      if (!from || !to) return null;
      return { gte: from, lt: new Date(to.getTime() + DAY_MS) };
    }
    case "in_last_days": {
      const days = Number(value);
      if (!Number.isFinite(days)) return null;
      return { gte: new Date(now.getTime() - days * DAY_MS), lte: now };
    }
    case "in_next_days": {
      const days = Number(value);
      if (!Number.isFinite(days)) return null;
      return { gte: now, lte: new Date(now.getTime() + days * DAY_MS) };
    }
    default:
      return null;
  }
}

function buildNumberFilter(clause: CrmFilterClause): Record<string, number> | null {
  const target = Number(clause.value);
  if (!Number.isFinite(target)) return null;

  switch (clause.operator) {
    case "eq":
      return { equals: target };
    case "neq":
      return { not: target };
    case "gt":
      return { gt: target };
    case "gte":
      return { gte: target };
    case "lt":
      return { lt: target };
    case "lte":
      return { lte: target };
    default:
      return null;
  }
}

// ============================================
// Field factories
// ============================================

interface FieldMeta {
  id: string;
  label: string;
  group: CrmFilterFieldGroup;
}

function textField(
  meta: FieldMeta,
  path: string[],
  nullable = true
): CrmPersonFilterField {
  return {
    ...meta,
    type: "text",
    operators: nullable ? undefined : withoutEmptiness("text"),
    toWhere: ({ operator, value }) => {
      const missing = missingWhere(path, "text", nullable);
      if (operator === "is_empty") return missing;
      if (operator === "is_not_empty") return missing ? negate(missing) : null;
      if (!value) return null;

      switch (operator) {
        case "contains":
          return nest(path, { contains: value, mode: "insensitive" });
        case "not_contains":
          return negateKeepingEmpty(
            nest(path, { contains: value, mode: "insensitive" }),
            missing
          );
        case "is":
          return nest(path, { equals: value, mode: "insensitive" });
        case "is_not":
          return negateKeepingEmpty(
            nest(path, { equals: value, mode: "insensitive" }),
            missing
          );
        default:
          return null;
      }
    },
  };
}

function numberField(
  meta: FieldMeta,
  path: string[],
  nullable = true
): CrmPersonFilterField {
  return {
    ...meta,
    type: "number",
    operators: nullable ? undefined : withoutEmptiness("number"),
    toWhere: (clause) => {
      const missing = missingWhere(path, "number", nullable);
      if (clause.operator === "is_empty") return missing;
      if (clause.operator === "is_not_empty") {
        return missing ? negate(missing) : null;
      }

      const filter = buildNumberFilter(clause);
      if (!filter) return null;

      return clause.operator === "neq"
        ? negateKeepingEmpty(nest(path, { equals: Number(clause.value) }), missing)
        : nest(path, filter);
    },
  };
}

function dateField(
  meta: FieldMeta,
  path: string[],
  nullable = true
): CrmPersonFilterField {
  return {
    ...meta,
    type: "date",
    operators: nullable ? undefined : withoutEmptiness("date"),
    toWhere: (clause) => {
      const missing = missingWhere(path, "date", nullable);
      if (clause.operator === "is_empty") return missing;
      if (clause.operator === "is_not_empty") {
        return missing ? negate(missing) : null;
      }
      const filter = buildDateFilter(clause);
      return filter ? nest(path, filter) : null;
    },
  };
}

function selectField(
  meta: FieldMeta,
  path: string[],
  options: Pick<CrmPersonFilterField, "options" | "optionsSource">,
  nullable = true
): CrmPersonFilterField {
  return {
    ...meta,
    type: "select",
    ...options,
    operators: nullable ? undefined : MEMBERSHIP_OPERATORS,
    toWhere: ({ operator, values }) => {
      const missing = missingWhere(path, "select", nullable);
      if (operator === "is_empty") return missing;
      if (operator === "is_not_empty") return missing ? negate(missing) : null;
      if (values.length === 0) return null;

      const where = nest(path, { in: values });
      return operator === "is_none_of"
        ? negateKeepingEmpty(where, missing)
        : where;
    },
  };
}

/** Owner pickers carry an "unassigned" option alongside the real user ids. */
function ownerField(meta: FieldMeta, path: string[]): CrmPersonFilterField {
  return {
    ...meta,
    type: "select",
    optionsSource: "owners",
    // "Unassigned" already covers the empty case
    operators: MEMBERSHIP_OPERATORS,
    toWhere: ({ operator, values }) => {
      if (values.length === 0) return null;

      const ids = values.filter((value) => value !== UNASSIGNED_OWNER);
      const wantsUnassigned = values.includes(UNASSIGNED_OWNER);

      const empty = missingWhere(path, "select", true);
      const clauses: Prisma.PersonWhereInput[] = [];
      if (ids.length > 0) clauses.push(nest(path, { in: ids }));
      // A contact with no company has no company owner either
      if (wantsUnassigned && empty) clauses.push(empty);

      const where = clauses.length === 1 ? clauses[0] : { OR: clauses };
      if (operator !== "is_none_of") return where;

      // Excluding named owners still leaves the unowned, unless the user asked
      // to exclude those too
      return negateKeepingEmpty(where, wantsUnassigned ? null : empty);
    },
  };
}

/** A yes/no field backed by a clause rather than a column. */
function booleanField(
  meta: FieldMeta,
  build: (yes: boolean, now: Date) => Prisma.PersonWhereInput
): CrmPersonFilterField {
  return {
    ...meta,
    type: "select",
    options: YES_NO_OPTIONS,
    operators: MEMBERSHIP_OPERATORS,
    toWhere: ({ operator, values, now }) => {
      // Both answers selected narrows nothing, so the condition is ignored
      if (values.length !== 1) return null;
      const yes =
        operator === "is_none_of" ? values[0] !== "yes" : values[0] === "yes";
      return build(yes, now);
    },
  };
}

/** Deals are matched on the contact or on the company they belong to. */
function anyDeal(where: Prisma.DealWhereInput): Prisma.PersonWhereInput {
  return {
    OR: [{ deals: { some: where } }, { company: { deals: { some: where } } }],
  };
}

function dealField(
  meta: FieldMeta,
  type: CrmColumnType,
  build: (clause: CrmFilterClause) => Prisma.DealWhereInput | null,
  options: Pick<CrmPersonFilterField, "options" | "optionsSource"> = {}
): CrmPersonFilterField {
  return {
    ...meta,
    type,
    ...options,
    // Emptiness is meaningless across a relation; "Has a deal" answers that
    operators:
      type === "select" ? MEMBERSHIP_OPERATORS : withoutEmptiness(type),
    toWhere: (clause) => {
      const dealWhere = build(clause);
      if (!dealWhere) return null;
      const where = anyDeal(dealWhere);
      const isNegative =
        clause.operator === "is_none_of" ||
        clause.operator === "is_not" ||
        clause.operator === "not_contains" ||
        clause.operator === "neq";
      return isNegative ? negate(where) : where;
    },
  };
}

function toOptions<T extends string>(
  order: T[],
  labels: Record<T, string>
): CrmFilterOption[] {
  return order.map((value) => ({ value, label: labels[value] }));
}

// ============================================
// The registry
// ============================================

export const PERSON_FILTER_FIELDS: CrmPersonFilterField[] = [
  // Contact
  textField({ id: "fullName", label: "Name", group: "Contact" }, ["fullName"]),
  textField({ id: "email", label: "Email", group: "Contact" }, ["email"]),
  textField({ id: "jobTitle", label: "Job title", group: "Contact" }, [
    "jobTitle",
  ]),
  selectField(
    { id: "lifecycleStage", label: "Lifecycle stage", group: "Contact" },
    ["lifecycleStage"],
    { options: toOptions(LIFECYCLE_STAGE_ORDER, LIFECYCLE_STAGE_LABELS) },
    false
  ),
  selectField(
    { id: "connectionStrength", label: "Connection strength", group: "Contact" },
    ["connectionStrength"],
    { options: toOptions(CONNECTION_STRENGTH_ORDER, CONNECTION_STRENGTH_LABELS) }
  ),
  ownerField({ id: "personOwner", label: "Contact owner", group: "Contact" }, [
    "ownerId",
  ]),
  textField({ id: "source", label: "Source", group: "Contact" }, ["source"]),
  booleanField(
    { id: "contactable", label: "Contactable", group: "Contact" },
    (yes) => ({ doNotContact: !yes })
  ),
  dateField(
    { id: "createdAt", label: "Created", group: "Contact" },
    ["createdAt"],
    false
  ),

  // Company
  textField(
    { id: "companyName", label: "Company name", group: "Company" },
    ["company", "name"],
    false
  ),
  selectField(
    { id: "companyStatus", label: "Company deal status", group: "Company" },
    ["company", "status"],
    { options: toOptions(COMPANY_STATUS_ORDER, COMPANY_STATUS_LABELS) },
    false
  ),
  selectField(
    { id: "companyIndustry", label: "Industry", group: "Company" },
    ["company", "industry"],
    { optionsSource: "industries" }
  ),
  numberField({ id: "companyEmployees", label: "Employees", group: "Company" }, [
    "company",
    "employeeCount",
  ]),
  textField({ id: "companyDomain", label: "Company domain", group: "Company" }, [
    "company",
    "domain",
  ]),
  ownerField({ id: "companyOwner", label: "Company owner", group: "Company" }, [
    "company",
    "ownerId",
  ]),
  booleanField(
    { id: "hasCompany", label: "Has a company", group: "Company" },
    (yes) => (yes ? { companyId: { not: null } } : { companyId: null })
  ),

  // Deal
  dealField(
    { id: "dealStage", label: "Deal stage", group: "Deal" },
    "select",
    ({ values }) => (values.length ? { stageId: { in: values } } : null),
    { optionsSource: "pipelineStages" }
  ),
  dealField(
    { id: "dealState", label: "Deal state", group: "Deal" },
    "select",
    ({ values }) => {
      const clauses: Prisma.DealWhereInput[] = [];
      if (values.includes("open")) {
        clauses.push({ stage: { isWon: false, isLost: false } });
      }
      if (values.includes("won")) clauses.push({ stage: { isWon: true } });
      if (values.includes("lost")) clauses.push({ stage: { isLost: true } });
      if (clauses.length === 0) return null;
      return clauses.length === 1 ? clauses[0] : { OR: clauses };
    },
    {
      options: [
        { value: "open", label: "Open" },
        { value: "won", label: "Won" },
        { value: "lost", label: "Lost" },
      ],
    }
  ),
  dealField(
    { id: "dealValue", label: "Deal value", group: "Deal" },
    "number",
    (clause) => {
      const filter = buildNumberFilter(clause);
      return filter ? { value: filter } : null;
    }
  ),
  dealField(
    { id: "dealCloseDate", label: "Deal close date", group: "Deal" },
    "date",
    (clause) => {
      const filter = buildDateFilter(clause);
      return filter ? { closeDate: filter } : null;
    }
  ),
  dealField(
    { id: "dealOwner", label: "Deal owner", group: "Deal" },
    "select",
    ({ values }) => {
      const ids = values.filter((value) => value !== UNASSIGNED_OWNER);
      const clauses: Prisma.DealWhereInput[] = [];
      if (ids.length > 0) clauses.push({ ownerId: { in: ids } });
      if (values.includes(UNASSIGNED_OWNER)) clauses.push({ ownerId: null });
      if (clauses.length === 0) return null;
      return clauses.length === 1 ? clauses[0] : { OR: clauses };
    },
    { optionsSource: "owners" }
  ),
  booleanField({ id: "hasDeal", label: "Has a deal", group: "Deal" }, (yes) => {
    const where = anyDeal({});
    return yes ? where : negate(where);
  }),

  // Activity
  dateField(
    { id: "lastEmailInteractionAt", label: "Last email", group: "Activity" },
    ["lastEmailInteractionAt"]
  ),
  dateField(
    { id: "lastCalendarInteractionAt", label: "Last meeting", group: "Activity" },
    ["lastCalendarInteractionAt"]
  ),
  dateField(
    { id: "nextCalendarEventAt", label: "Next meeting", group: "Activity" },
    ["nextCalendarEventAt"]
  ),
  booleanField(
    { id: "hasUpcomingMeeting", label: "Has an upcoming meeting", group: "Activity" },
    (yes, now) =>
      yes
        ? { nextCalendarEventAt: { gte: now } }
        : {
          OR: [
            { nextCalendarEventAt: null },
            { nextCalendarEventAt: { lt: now } },
          ],
        }
  ),
  {
    id: "formSubmission",
    label: "Submitted form",
    group: "Activity",
    type: "select",
    options: [
      { value: "REGULAR", label: "Regular form" },
      { value: "BUSINESSOS", label: "BusinessOS form" },
    ],
    operators: MEMBERSHIP_OPERATORS,
    toWhere: ({ operator, values }) => {
      if (values.length === 0) return null;
      const where: Prisma.PersonWhereInput = {
        formSubmissions: { some: { type: { in: values as never[] } } },
      };
      return operator === "is_none_of" ? negate(where) : where;
    },
  },
  {
    id: "formSubmittedAt",
    label: "Form submitted",
    group: "Activity",
    type: "date",
    operators: withoutEmptiness("date"),
    toWhere: (clause) => {
      const filter = buildDateFilter(clause);
      if (!filter) return null;
      return { formSubmissions: { some: { createdAt: filter } } };
    },
  },
  {
    id: "sequenceMembership",
    label: "Sequence membership",
    group: "Activity",
    type: "select",
    options: [
      { value: "never", label: "Never enrolled" },
      { value: "active", label: "In an active sequence" },
      { value: "past", label: "Previously enrolled" },
    ],
    operators: MEMBERSHIP_OPERATORS,
    toWhere: ({ operator, values }) => {
      const clauses: Prisma.PersonWhereInput[] = [];
      if (values.includes("never")) {
        clauses.push({ sequenceEnrollments: { none: {} } });
      }
      if (values.includes("active")) {
        clauses.push({ sequenceEnrollments: { some: { status: "ACTIVE" } } });
      }
      if (values.includes("past")) {
        clauses.push({
          AND: [
            { sequenceEnrollments: { some: {} } },
            { sequenceEnrollments: { none: { status: "ACTIVE" } } },
          ],
        });
      }
      if (clauses.length === 0) return null;

      const where = clauses.length === 1 ? clauses[0] : { OR: clauses };
      return operator === "is_none_of" ? negate(where) : where;
    },
  },
];

export function getPersonFilterField(
  id: string
): CrmPersonFilterField | undefined {
  return PERSON_FILTER_FIELDS.find((field) => field.id === id);
}
