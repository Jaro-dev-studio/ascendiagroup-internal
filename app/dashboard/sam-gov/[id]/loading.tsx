import { Skeleton } from "@/components/ui/skeleton";

export default function GovContractDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="size-10 rounded-md" />
        <div>
          <Skeleton className="h-7 w-72" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
      </div>

      {/* Status Stepper */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 shrink-0 rounded-full" />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-1">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-28" />
        ))}
      </div>

      {/* Content */}
      <div className="rounded-lg border border-border p-6">
        <div className="grid grid-cols-2 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
