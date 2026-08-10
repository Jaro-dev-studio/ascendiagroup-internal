import { Skeleton } from "@/components/ui/skeleton";

export default function RecordingRulesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-row items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex flex-row gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {[...Array(2)].map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-background p-5"
          >
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-4 w-56" />
            <Skeleton className="mt-2 h-4 w-72" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-background p-5">
        <Skeleton className="h-5 w-44" />
        <div className="mt-4 flex flex-col gap-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-80" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
