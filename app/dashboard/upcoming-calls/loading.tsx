import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function UpcomingCallsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Calls list */}
      <Card className="overflow-hidden">
        <div className="border-b border-secondary-100 px-6 py-4">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="divide-y divide-secondary-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-4 p-4">
              <Skeleton className="size-12 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex items-center gap-2">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="size-6 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-6 w-24 shrink-0" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
