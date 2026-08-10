import { Skeleton } from "@/components/ui/skeleton";

export function CrmDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-row items-start gap-3">
          <Skeleton className="size-10 rounded-md" />
          <div>
            <Skeleton className="h-8 w-56" />
            <Skeleton className="mt-2 h-4 w-40" />
          </div>
        </div>
        <div className="flex flex-row gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex flex-row gap-4 border-b border-border pb-2">
            {[...Array(4)].map((_, index) => (
              <Skeleton key={index} className="h-6 w-24" />
            ))}
          </div>
          {[...Array(4)].map((_, index) => (
            <div
              key={index}
              className="rounded-lg border border-border bg-background p-4"
            >
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <Skeleton className="h-4 w-20" />
          <div className="mt-4 flex flex-col gap-4">
            {[...Array(6)].map((_, index) => (
              <div key={index}>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-1 h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
