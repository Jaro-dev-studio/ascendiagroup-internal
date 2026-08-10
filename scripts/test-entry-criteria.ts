/**
 * Checks that every filter field, and every operator, produces a Prisma query
 * the database actually accepts, for both sequence entry and exit criteria.
 * Read-only: it only ever counts.
 *
 * Run with: pnpm tsx --env-file=.env scripts/test-entry-criteria.ts
 */
import prisma from "../lib/prisma";
import {
  PERSON_FILTER_FIELDS,
  type CrmPersonFilterField,
} from "../config/crm-filter-fields";
import { buildPersonWhere } from "../lib/crm/filters/person-where";
import { buildEnrollableWhere } from "../lib/crm/sequences/entry-criteria";
import { buildExitWhere } from "../lib/crm/sequences/exit-criteria";
import { getCrmFilterOptions } from "../lib/fetchers/crm-filters";
import { getOperatorsForType } from "../components/crm-table/utils";
import type {
  CrmFilterCondition,
  CrmFilterGroup,
  CrmFilterOperator,
  CrmFilterOption,
} from "../components/crm-table/types";

const LOG = "[EntryCriteriaTest]";

let checks = 0;
const failures: string[] = [];

function condition(
  field: CrmPersonFilterField,
  operator: CrmFilterOperator,
  options: CrmFilterOption[]
): CrmFilterCondition {
  const base = { id: `${field.id}-${operator}`, columnId: field.id, operator };

  switch (field.type) {
    case "select": {
      // Yes/no fields mean nothing with both answers ticked
      const isYesNo = options.every((option) =>
        ["yes", "no"].includes(option.value)
      );
      const chosen = options.slice(0, isYesNo ? 1 : 2);
      return { ...base, value: chosen.map((option) => option.value) };
    }
    case "number":
      return { ...base, value: "10" };
    case "date":
      return operator === "in_last_days" || operator === "in_next_days"
        ? { ...base, value: "30" }
        : { ...base, value: "2026-01-01", value2: "2026-06-01" };
    default:
      return { ...base, value: "a" };
  }
}

function group(children: CrmFilterCondition[]): CrmFilterGroup {
  return { id: "root", combinator: "and", children };
}

async function check(label: string, filters: CrmFilterGroup): Promise<void> {
  checks += 1;
  const where = buildPersonWhere(filters);

  if (!where) {
    failures.push(`${label}: produced no clause`);
    return;
  }

  try {
    const count = await prisma.person.count({ where });
    console.log(`${LOG} ok   ${label} -> ${count}`);
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    failures.push(`${label}: ${message}`);
    console.error(`${LOG} FAIL ${label}: ${message}`);
  }
}

/** Counts contacts for one field and operator, used by the partition checks. */
async function countWhere(
  field: CrmPersonFilterField,
  operator: CrmFilterOperator,
  values: readonly string[]
): Promise<number> {
  const where = buildPersonWhere(
    group([
      {
        id: `${field.id}-${operator}`,
        columnId: field.id,
        operator,
        value: field.type === "text" ? values[0] : [...values],
      },
    ])
  );

  return where ? prisma.person.count({ where }) : 0;
}

async function main() {
  console.log(`${LOG} loading dynamic filter options...`);
  const optionsResult = await getCrmFilterOptions();
  const dynamicOptions = optionsResult.data;
  if (!dynamicOptions) throw new Error(optionsResult.error ?? "No filter options");

  console.log(
    `${LOG} ${PERSON_FILTER_FIELDS.length} fields, ${dynamicOptions.owners.length} owners, ${dynamicOptions.pipelineStages.length} stages, ${dynamicOptions.industries.length} industries`
  );

  for (const field of PERSON_FILTER_FIELDS) {
    const options = field.optionsSource
      ? dynamicOptions[field.optionsSource]
      : (field.options ?? []);

    if (field.type === "select" && options.length === 0) {
      console.log(`${LOG} skip ${field.id}: no options available to test with`);
      continue;
    }

    // Every operator the builder can offer for this field
    for (const operator of field.operators ?? getOperatorsForType(field.type)) {
      await check(
        `${field.id} ${operator}`,
        group([condition(field, operator, options)])
      );
    }
  }

  console.log(`${LOG} checking a nested and/or tree...`);
  const [stage] = PERSON_FILTER_FIELDS.filter((field) => field.id === "lifecycleStage");
  const nested: CrmFilterGroup = {
    id: "root",
    combinator: "and",
    children: [
      condition(stage, "is_any_of", stage.options ?? []),
      {
        id: "nested",
        combinator: "or",
        children: [
          { id: "n1", columnId: "companyEmployees", operator: "gte", value: "50" },
          { id: "n2", columnId: "hasUpcomingMeeting", operator: "is_any_of", value: ["yes"] },
          {
            id: "n3",
            combinator: "and",
            children: [
              { id: "n3a", columnId: "dealState", operator: "is_any_of", value: ["open"] },
              { id: "n3b", columnId: "dealValue", operator: "gt", value: "1000" },
            ],
          },
        ],
      },
    ],
  };
  await check("nested and/or tree", nested);

  console.log(`${LOG} checking the enrollable guards...`);
  const exitTree: CrmFilterGroup = {
    id: "exit",
    combinator: "or",
    children: [
      { id: "e1", columnId: "lifecycleStage", operator: "is_any_of", value: ["DISQUALIFIED", "CUSTOMER"] },
      { id: "e2", columnId: "hasUpcomingMeeting", operator: "is_any_of", value: ["yes"] },
    ],
  };

  checks += 1;
  const enrollable = buildEnrollableWhere({ filters: nested, sequenceId: null });
  if (!enrollable) {
    failures.push("enrollable guards: produced no clause");
  } else {
    const count = await prisma.person.count({ where: enrollable });
    console.log(`${LOG} ok   enrollable guards -> ${count}`);
  }

  // A filter and its negation must cover everyone: Postgres silently drops
  // null rows from a NOT, which used to make "is none of" hide blank records
  console.log(`${LOG} checking that negations keep contacts with no value...`);
  const total = await prisma.person.count();

  for (const [fieldId, values] of [
    ["companyIndustry", ["Software"]],
    ["personOwner", ["unassigned"]],
    ["companyOwner", ["unassigned"]],
    ["companyName", ["a"]],
  ] as const) {
    const field = PERSON_FILTER_FIELDS.find((entry) => entry.id === fieldId);
    if (!field) continue;

    checks += 1;
    const positive = field.type === "text" ? "contains" : "is_any_of";
    const negative = field.type === "text" ? "not_contains" : "is_none_of";

    const [inside, outside] = await Promise.all([
      countWhere(field, positive, values),
      countWhere(field, negative, values),
    ]);

    if (inside + outside !== total) {
      failures.push(
        `${fieldId}: ${positive} (${inside}) + ${negative} (${outside}) != ${total} contacts`
      );
    } else {
      console.log(`${LOG} ok   ${fieldId} partitions ${total} contact(s)`);
    }
  }

  console.log(`${LOG} checking exit criteria against active enrollments...`);
  checks += 1;
  const exitWhere = buildExitWhere(exitTree);
  if (!exitWhere) {
    failures.push("exit criteria: produced no clause");
  } else {
    const count = await prisma.sequenceEnrollment.count({
      where: { status: "ACTIVE", person: exitWhere },
    });
    console.log(`${LOG} ok   exit criteria -> ${count} active enrollment(s)`);
  }

  console.log(`${LOG} ${checks - failures.length}/${checks} checks passed`);
  if (failures.length > 0) {
    console.error(`${LOG} FAILURES:\n${failures.join("\n")}`);
    throw new Error(`${failures.length} check(s) failed`);
  }
  console.log(`${LOG} PASS`);
}

main()
  .catch((error) => {
    console.error(`${LOG} FAIL`, error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
