import { Skeleton } from "@/components/ui/skeleton";

export default function ClientActionItemsLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      {/* Search and View Toggle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-72" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Checkbox */}
      <div className="flex items-center gap-2">
        <Skeleton className="size-4" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-border bg-background">
        <div className="border-b p-4">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4 border-b p-4 last:border-b-0">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
