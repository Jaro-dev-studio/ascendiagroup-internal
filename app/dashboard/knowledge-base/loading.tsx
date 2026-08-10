import { Card } from "@/components/ui/card";

export default function KnowledgeBaseLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 animate-pulse rounded bg-secondary-200" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-secondary-200" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-40 animate-pulse rounded bg-secondary-200" />
          <div className="h-10 w-36 animate-pulse rounded bg-secondary-200" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-5">
            <div className="space-y-3">
              <div className="h-5 w-3/4 animate-pulse rounded bg-secondary-200" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-secondary-200" />
              <div className="flex items-center gap-2">
                <div className="h-5 w-16 animate-pulse rounded-full bg-secondary-200" />
                <div className="h-4 w-20 animate-pulse rounded bg-secondary-200" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
