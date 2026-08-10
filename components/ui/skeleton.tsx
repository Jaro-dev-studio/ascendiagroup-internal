import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-md",
        "bg-background-secondary dark:bg-background-dark",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-skeleton before:bg-gradient-to-r",
        "before:from-transparent before:via-text-secondary/20 dark:before:via-text-light/10 before:to-transparent",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
