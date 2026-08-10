import { Skeleton } from "@/components/ui/skeleton";

export default function MarketResearchLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-72" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-4">
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="rounded-lg border border-border p-6">
        <Skeleton className="mb-4 h-6 w-48" />
        <Skeleton className="h-80 w-full" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-6">
          <Skeleton className="mb-4 h-6 w-48" />
          <Skeleton className="h-72 w-full" />
        </div>
        <div className="rounded-lg border border-border p-6">
          <Skeleton className="mb-4 h-6 w-48" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    </div>
  );
}
