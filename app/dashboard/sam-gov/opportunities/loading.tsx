import { Skeleton } from "@/components/ui/skeleton";

export default function OpportunitiesLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-56" />
          </div>
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 min-w-[200px] flex-1" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-10 w-44" />
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Skeleton className="h-5 w-3/4" />
                <div className="mt-2 flex gap-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="mt-2 h-4 w-full" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="size-8" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
