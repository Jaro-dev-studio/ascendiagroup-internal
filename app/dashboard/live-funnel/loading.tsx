import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LiveFunnelLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-8 w-36" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-44" />
          <Skeleton className="size-10" />
        </div>
      </div>

      {/* Time period indicator */}
      <Skeleton className="h-12 w-full" />

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-2 h-8 w-32" />
                <Skeleton className="mt-1 h-4 w-20" />
              </div>
              <Skeleton className="size-10 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-2 h-8 w-24" />
              </div>
              <Skeleton className="size-10 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>

      {/* Funnel Visualization */}
      <Card className="p-6">
        <Skeleton className="mb-6 h-6 w-40" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-6 h-16 w-full" />
      </Card>
    </div>
  );
}
