import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
}

export function Logo({
  className,
  markClassName,
  showWordmark = true,
}: LogoProps) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground",
          markClassName
        )}
        aria-hidden="true"
      >
        A
      </span>
      {showWordmark && (
        <span className="text-base font-semibold tracking-tight text-secondary-900">
          Ascendiagroup
        </span>
      )}
    </span>
  );
}
