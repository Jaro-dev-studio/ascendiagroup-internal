import type {
  CrmColumnDef,
  CrmFilterOption,
} from "@/components/crm-table/types";
import {
  PERSON_FILTER_FIELDS,
  type CrmFilterOptionSource,
} from "@/config/crm-filter-fields";

/** Option lists that have to be read from the database before rendering. */
export type CrmFilterDynamicOptions = Record<
  CrmFilterOptionSource,
  CrmFilterOption[]
>;

export const EMPTY_DYNAMIC_OPTIONS: CrmFilterDynamicOptions = {
  owners: [],
  pipelineStages: [],
  industries: [],
};

/**
 * Adapts the field registry to the column shape the shared filter builder
 * expects. There is no accessor: these filters are evaluated by the database,
 * not against rows held in the browser.
 */
export function toFilterColumns(
  dynamicOptions: CrmFilterDynamicOptions
): CrmColumnDef<unknown>[] {
  return PERSON_FILTER_FIELDS.map((field) => ({
    id: field.id,
    header: field.label,
    group: field.group,
    type: field.type,
    filterable: true,
    operators: field.operators,
    filterOptions: field.optionsSource
      ? dynamicOptions[field.optionsSource]
      : field.options,
  }));
}
