export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center justify-between border-b border-secondary-200 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="h-4 w-24 animate-pulse rounded bg-secondary-200" />
          <div className="h-6 w-48 animate-pulse rounded bg-secondary-200" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 animate-pulse rounded bg-secondary-200" />
          <div className="h-9 w-20 animate-pulse rounded bg-secondary-200" />
        </div>
      </div>
      <div className="flex-1 animate-pulse bg-secondary-50" />
    </div>
  );
}
