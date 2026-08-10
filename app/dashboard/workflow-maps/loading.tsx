import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-8 w-48 animate-pulse rounded bg-secondary-200" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-secondary-200" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded bg-secondary-200" />
      </div>

      <div className="h-10 w-full animate-pulse rounded-md bg-secondary-200" />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-secondary-200">
                <th className="px-6 py-3">
                  <div className="h-4 w-20 animate-pulse rounded bg-secondary-200" />
                </th>
                <th className="px-6 py-3">
                  <div className="h-4 w-24 animate-pulse rounded bg-secondary-200" />
                </th>
                <th className="px-6 py-3">
                  <div className="h-4 w-20 animate-pulse rounded bg-secondary-200" />
                </th>
                <th className="px-6 py-3">
                  <div className="h-4 w-24 animate-pulse rounded bg-secondary-200" />
                </th>
                <th className="px-6 py-3">
                  <div className="h-4 w-16 animate-pulse rounded bg-secondary-200" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-200">
              {[...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4">
                    <div className="h-5 w-40 animate-pulse rounded bg-secondary-200" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-5 w-32 animate-pulse rounded bg-secondary-200" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-5 w-24 animate-pulse rounded bg-secondary-200" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-5 w-20 animate-pulse rounded bg-secondary-200" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="size-8 animate-pulse rounded bg-secondary-200" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
