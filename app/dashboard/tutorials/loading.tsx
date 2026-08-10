import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function TutorialsLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header Skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Quick tips Skeleton */}
      <Card className="border-secondary-200">
        <div className="flex items-start gap-3 p-4">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="mb-2 h-5 w-40" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </Card>

      {/* Section title */}
      <div>
        <Skeleton className="mb-4 h-6 w-32" />
        
        {/* Tutorial Cards Skeleton */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              {/* Thumbnail */}
              <Skeleton className="aspect-video w-full" />
              
              {/* Content */}
              <div className="flex flex-col gap-2 p-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="mt-2 h-9 w-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
