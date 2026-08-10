export default function MVPSalesViewLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b border-secondary-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="size-10 animate-pulse rounded bg-secondary-200" />
          <div>
            <div className="h-6 w-48 animate-pulse rounded bg-secondary-200" />
            <div className="mt-1 h-4 w-32 animate-pulse rounded bg-secondary-100" />
          </div>
        </div>
        <div className="h-10 w-32 animate-pulse rounded bg-secondary-200" />
      </div>

      {/* Tabs skeleton */}
      <div className="border-b border-secondary-200 bg-secondary-50 px-6 py-3">
        <div className="flex gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-10 w-32 animate-pulse rounded bg-secondary-200"
            />
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="h-96 animate-pulse rounded-lg bg-secondary-100" />
        </div>
      </div>
    </div>
  );
}
