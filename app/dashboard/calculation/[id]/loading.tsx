import { Skeleton } from "@/components/ui/skeleton";

export default function CalculationDetailLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="size-8" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 bg-background-secondary/30">
        <div className="flex h-full items-center justify-center">
          <Skeleton className="size-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
