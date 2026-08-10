import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function OverviewLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-1 h-4 w-48" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-44" />
          <Skeleton className="size-10" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-2 h-8 w-32" />
                <Skeleton className="mt-1 h-4 w-20" />
              </div>
              <Skeleton className="size-12 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      <div>
        <Skeleton className="mb-4 h-6 w-40" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="mt-1 h-4 w-full" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Funnel */}
      <div>
        <Skeleton className="mb-4 h-6 w-32" />
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-48 rounded-lg" />
            ))}
          </div>
        </Card>
      </div>

      {/* Client Pipeline */}
      <div>
        <Skeleton className="mb-4 h-6 w-36" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="mt-1 h-4 w-20" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
