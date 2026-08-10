import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function ProfileLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Form Skeleton */}
        <Card className="lg:col-span-2">
          <div className="border-b border-secondary-200 p-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-1 h-4 w-48" />
          </div>

          <div className="flex flex-col gap-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-3 w-40" />
            </div>

            <div className="flex justify-end pt-2">
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </Card>

        {/* Account Information Skeleton */}
        <Card>
          <div className="border-b border-secondary-200 p-4">
            <Skeleton className="h-5 w-32" />
          </div>

          <div className="flex flex-col gap-4 p-4">
            {/* Avatar */}
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-1 h-4 w-40" />
              </div>
            </div>

            <div className="h-px bg-secondary-200" />

            {/* Info items */}
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="mt-1 h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
