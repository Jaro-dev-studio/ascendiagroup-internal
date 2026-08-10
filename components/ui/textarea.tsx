import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex w-full rounded-md text-sm font-light transition-colors",
        "border-2 border-border bg-background text-text",
        "placeholder:text-text-secondary",
        "hover:bg-background-secondary/20",
        "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
        "disabled:pointer-events-none disabled:opacity-50",
        "dark:border-border-dark dark:bg-background-dark dark:text-text-light",
        "dark:hover:bg-background-secondary/10",
        "has-[.state-error]:border-state-error has-[.state-error]:border-2",
        "has-[.state-success]:border-state-success has-[.state-success]:border-2",
        "min-h-[80px] px-4 py-2",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
