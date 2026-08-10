"use client";

import { formatNumber } from "@/lib/utils";

interface BarChartProps {
  data: { label: string; value: number }[];
  unit?: string;
}

/**
 * Small dependency-free bar chart. The dashboard only needs comparative bars,
 * so a plain flex layout keeps the client bundle lean.
 */
export function BarChart({ data, unit }: BarChartProps) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="flex flex-col gap-3">
      {data.map((item) => (
        <div key={item.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate font-medium text-secondary-700">
              {item.label}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatNumber(item.value, 2)}
              {unit ? ` ${unit}` : ""}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary-100">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
