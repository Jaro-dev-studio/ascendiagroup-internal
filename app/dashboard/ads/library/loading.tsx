import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function LibraryCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-[9/16] w-full" />
      <div className="p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="mt-1 h-4 w-full" />
        <div className="mt-2 flex gap-1">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
    </Card>
  );
}

export default function AdLibraryLoading() {
  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-full sm:w-40" />
          <Skeleton className="h-10 w-full sm:w-36" />
        </div>
      </Card>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(8)].map((_, i) => (
          <LibraryCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
