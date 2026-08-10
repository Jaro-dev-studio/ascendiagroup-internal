import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <div className="size-10 animate-pulse rounded-lg bg-secondary-200" />
        <div>
          <div className="h-7 w-64 animate-pulse rounded bg-secondary-200" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded bg-secondary-200" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content skeleton */}
        <div className="space-y-6 lg:col-span-2">
          {/* Prospect info card */}
          <Card className="p-6">
            <div className="h-6 w-32 animate-pulse rounded bg-secondary-200" />
            <div className="mt-4 space-y-3">
              <div className="h-4 w-full animate-pulse rounded bg-secondary-200" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-secondary-200" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-secondary-200" />
            </div>
          </Card>

          {/* Audit sections skeleton */}
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-6">
              <div className="flex items-center justify-between">
                <div className="h-6 w-48 animate-pulse rounded bg-secondary-200" />
                <div className="h-6 w-16 animate-pulse rounded bg-secondary-200" />
              </div>
              <div className="mt-4 space-y-3">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <div className="size-5 animate-pulse rounded bg-secondary-200" />
                    <div className="h-4 flex-1 animate-pulse rounded bg-secondary-200" />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Sidebar skeleton */}
        <div className="space-y-6">
          {/* Summary card */}
          <Card className="p-6">
            <div className="h-6 w-32 animate-pulse rounded bg-secondary-200" />
            <div className="mt-4 space-y-4">
              <div className="h-24 w-full animate-pulse rounded bg-secondary-200" />
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="h-4 w-24 animate-pulse rounded bg-secondary-200" />
                    <div className="h-4 w-12 animate-pulse rounded bg-secondary-200" />
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Improvements card */}
          <Card className="p-6">
            <div className="h-6 w-40 animate-pulse rounded bg-secondary-200" />
            <div className="mt-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-lg border border-secondary-200 p-3">
                  <div className="h-4 w-full animate-pulse rounded bg-secondary-200" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-secondary-200" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
