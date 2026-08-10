import type { ReactNode } from "react";

interface DetailFieldProps {
  label: string;
  children: ReactNode;
}

export function DetailField({ label, children }: DetailFieldProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-text-tertiary">
        {label}
      </dt>
      <dd className="text-text-dark break-words text-sm">{children}</dd>
    </div>
  );
}
