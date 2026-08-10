import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewCalculationLoading() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>

      {/* Form */}
      <Card className="p-6">
        <div className="space-y-6">
          <div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-2 h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-24 w-full" />
          </div>
          <div className="flex justify-end gap-3">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </Card>
    </div>
  );
}
