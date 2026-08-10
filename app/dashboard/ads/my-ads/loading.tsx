import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function AdCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-[9/16] w-full" />
      <div className="p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="mt-1 h-4 w-1/2" />
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded bg-secondary-50 px-2 py-1">
              <Skeleton className="h-2.5 w-10" />
              <Skeleton className="mt-1 h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function MyAdsLoading() {
  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-full sm:w-40" />
          <Skeleton className="h-10 w-full sm:w-48" />
          <Skeleton className="size-10" />
        </div>
      </Card>

      {/* Ads Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <AdCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
