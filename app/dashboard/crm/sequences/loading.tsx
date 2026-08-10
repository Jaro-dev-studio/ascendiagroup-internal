import { Skeleton } from "@/components/ui/skeleton";

export default function SequencesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-row items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex flex-row gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-background p-4"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-8 w-16" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {[...Array(3)].map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-background p-5"
          >
            <Skeleton className="h-5 w-52" />
            <Skeleton className="mt-2 h-4 w-72" />
            <Skeleton className="mt-2 h-3 w-96" />
          </div>
        ))}
      </div>
    </div>
  );
}
