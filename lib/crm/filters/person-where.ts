import type { Prisma } from "@prisma/client";
import type {
  CrmFilterCondition,
  CrmFilterGroup,
} from "@/components/crm-table/types";
import {
  isConditionActive,
  isFilterGroup,
  normaliseFilterGroup,
} from "@/components/crm-table/utils";
import { getPersonFilterField } from "@/config/crm-filter-fields";

/**
 * Translates a saved filter tree into a Prisma contact query, mirroring what
 * the client-side evaluator does for in-memory rows. Conditions the registry
 * does not recognise, or that are still half-filled, are dropped rather than
 * failing, so an in-progress filter never throws at query time.
 */
export function buildPersonWhere(
  filters: unknown,
  now: Date = new Date()
): Prisma.PersonWhereInput | null {
  return groupToWhere(normaliseFilterGroup(filters), now);
}

function groupToWhere(
  group: CrmFilterGroup,
  now: Date
): Prisma.PersonWhereInput | null {
  const clauses: Prisma.PersonWhereInput[] = [];

  for (const child of group.children) {
    const where = isFilterGroup(child)
      ? groupToWhere(child, now)
      : conditionToWhere(child, now);
    if (where) clauses.push(where);
  }

  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0];

  return group.combinator === "or" ? { OR: clauses } : { AND: clauses };
}

function conditionToWhere(
  condition: CrmFilterCondition,
  now: Date
): Prisma.PersonWhereInput | null {
  if (!isConditionActive(condition)) return null;

  const field = getPersonFilterField(condition.columnId);
  if (!field) return null;

  const values = Array.isArray(condition.value)
    ? condition.value.map(String)
    : condition.value === null || condition.value === ""
      ? []
      : [String(condition.value)];

  return field.toWhere({
    operator: condition.operator,
    values,
    value: Array.isArray(condition.value) ? "" : condition.value ?? "",
    value2: condition.value2 ?? "",
    now,
  });
}
