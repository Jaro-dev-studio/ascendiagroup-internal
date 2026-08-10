import { Skeleton } from "@/components/ui/skeleton";

export default function RecurringTasksLoading() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Search */}
      <div className="mb-6">
        <Skeleton className="h-10 w-72" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-background">
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border p-4 last:border-b-0">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="size-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
