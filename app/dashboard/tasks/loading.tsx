import { Skeleton } from "@/components/ui/skeleton";

export default function TasksLoading() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>

      {/* Search and View Toggle */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-72" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-background">
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border p-4 last:border-b-0">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="size-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
