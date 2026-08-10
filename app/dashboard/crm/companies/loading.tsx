import { CrmTableSkeleton } from "@/components/crm/crm-table-skeleton";

export default function CrmCompaniesLoading() {
  return <CrmTableSkeleton columns={8} rows={12} />;
}
