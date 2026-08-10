import { Skeleton } from "@/components/ui/skeleton";

interface CrmTableSkeletonProps {
  /** Number of placeholder columns per row */
  columns?: number;
  rows?: number;
}

export function CrmTableSkeleton({
  columns = 6,
  rows = 8,
}: CrmTableSkeletonProps) {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-72" />
        <div className="flex flex-row gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background">
        <div className="border-b border-border p-4">
          <div className="flex flex-row items-center gap-4">
            {[...Array(columns)].map((_, index) => (
              <Skeleton key={index} className="h-4 w-24" />
            ))}
          </div>
        </div>
        {[...Array(rows)].map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="flex flex-row items-center gap-4 border-b border-border p-4 last:border-b-0"
          >
            {[...Array(columns)].map((_, index) => (
              <Skeleton key={index} className="h-5 w-24" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
