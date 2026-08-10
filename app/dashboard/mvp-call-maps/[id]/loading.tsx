import { Card } from "@/components/ui/card";

export default function MVPCallMapDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="size-10 animate-pulse rounded bg-secondary-200" />
          <div>
            <div className="h-8 w-48 animate-pulse rounded bg-secondary-200" />
            <div className="mt-2 h-5 w-32 animate-pulse rounded bg-secondary-100" />
          </div>
        </div>
        <div className="h-12 w-40 animate-pulse rounded bg-secondary-200" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <div className="h-6 w-48 animate-pulse rounded bg-secondary-200" />
            <div className="mt-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="size-10 animate-pulse rounded-lg bg-secondary-100" />
                  <div>
                    <div className="h-4 w-20 animate-pulse rounded bg-secondary-100" />
                    <div className="mt-1 h-5 w-32 animate-pulse rounded bg-secondary-200" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="h-6 w-32 animate-pulse rounded bg-secondary-200" />
            <div className="mt-4 space-y-3">
              <div className="h-24 w-full animate-pulse rounded bg-secondary-100" />
              <div className="h-4 w-full animate-pulse rounded bg-secondary-100" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-secondary-100" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
