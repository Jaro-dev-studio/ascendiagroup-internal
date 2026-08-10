import { Skeleton } from "@/components/ui/skeleton";

export default function SamGovLoading() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex min-w-[280px] shrink-0 flex-col rounded-lg border border-border p-4">
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <div className="flex flex-col gap-2">
              {[...Array(i < 3 ? 2 : 1)].map((_, j) => (
                <div key={j} className="rounded-lg border border-border p-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="mt-2 h-3 w-24" />
                  <Skeleton className="mt-1 h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
