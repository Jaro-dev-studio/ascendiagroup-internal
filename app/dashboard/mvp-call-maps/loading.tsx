import { Card } from "@/components/ui/card";

export default function MVPCallMapsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-8 w-48 animate-pulse rounded bg-secondary-200" />
          <div className="mt-2 h-5 w-64 animate-pulse rounded bg-secondary-100" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded bg-secondary-200" />
      </div>

      <div className="h-10 w-full animate-pulse rounded bg-secondary-100" />

      <Card>
        <div className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-10 animate-pulse rounded-lg bg-secondary-200" />
                  <div>
                    <div className="h-5 w-48 animate-pulse rounded bg-secondary-200" />
                    <div className="mt-1 h-4 w-32 animate-pulse rounded bg-secondary-100" />
                  </div>
                </div>
                <div className="h-8 w-24 animate-pulse rounded bg-secondary-200" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
