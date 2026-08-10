import { Skeleton } from "@/components/ui/skeleton";

export default function RolesLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Back Link */}
      <Skeleton className="h-4 w-32" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-28" />
      </div>

      {/* Roles List */}
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-2 h-4 w-full max-w-md" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="size-9" />
                <Skeleton className="size-9" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
