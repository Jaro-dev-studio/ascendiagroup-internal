import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdGeneratorLoading() {
  return (
    <div className="space-y-6">
      {/* Tabs Skeleton */}
      <div className="flex gap-2 border-b border-secondary-200 pb-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-28" />
        ))}
      </div>

      {/* Content Skeleton */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border p-4">
              <Skeleton className="h-5 w-64" />
              <div className="flex gap-2">
                <Skeleton className="size-8" />
                <Skeleton className="size-8" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
