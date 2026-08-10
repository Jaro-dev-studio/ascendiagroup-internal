import { Skeleton } from "@/components/ui/skeleton";
import { CrmTableSkeleton } from "@/components/crm/crm-table-skeleton";

export default function CrmDealsLoading() {
  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-background p-4"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-8 w-24" />
          </div>
        ))}
      </div>
      <CrmTableSkeleton columns={6} />
    </div>
  );
}
