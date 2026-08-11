import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  href?: string;
  tone?: "primary" | "accent" | "warning" | "neutral";
}

const TONES = {
  primary: "bg-primary-50 text-primary-600",
  accent: "bg-accent-50 text-accent-600",
  warning: "bg-warning-50 text-warning-600",
  neutral: "bg-secondary-100 text-secondary-600",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "primary",
}: StatCardProps) {
  const content = (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-secondary-900">
          {value}
        </p>
        {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          TONES[tone]
        )}
      >
        <Icon className="size-4" />
      </span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
