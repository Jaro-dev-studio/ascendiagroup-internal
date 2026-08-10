import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "dark:focus:ring-text-light inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-text focus:ring-offset-2 dark:border-border-dark",
  {
    variants: {
      variant: {
        default:
          "text-light dark:text-text-dark border-transparent bg-neutral-200 dark:bg-background dark:hover:bg-background/80",
        secondary:
          "dark:text-text-light hover:text-text-light border-transparent bg-background-secondary text-text dark:bg-background-dark dark:hover:bg-background-dark/80",
        destructive:
          "bg-danger hover:bg-danger/80 dark:bg-danger-dark dark:hover:bg-danger-dark/80 border-transparent text-white dark:text-white",
        outline: "dark:text-text-light text-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
