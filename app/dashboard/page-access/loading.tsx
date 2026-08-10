import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PageAccessLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <Skeleton className="h-10 w-64" />

      <div className="flex flex-col gap-6 lg:flex-row">
        <Card className="lg:w-72">
          <div className="flex flex-col gap-3 p-4">
            {[...Array(6)].map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        </Card>

        <Card className="flex-1">
          <div className="flex flex-col gap-4 p-4">
            {[...Array(8)].map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
