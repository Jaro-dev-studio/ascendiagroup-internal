import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function UsersLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <div className="border-b border-secondary-200 px-6 py-3">
            <div className="flex items-center gap-6">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-6 border-b border-secondary-200 px-6 py-4 last:border-b-0">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="size-8" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
