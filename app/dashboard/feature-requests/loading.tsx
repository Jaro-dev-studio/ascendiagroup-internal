import { Skeleton } from "@/components/ui/skeleton";

export default function FeatureRequestsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-44" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-background">
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border p-4 last:border-b-0">
            <div className="w-2/5">
              <Skeleton className="h-5 w-full max-w-md" />
              <Skeleton className="mt-1 h-4 w-3/4" />
            </div>
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="size-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
