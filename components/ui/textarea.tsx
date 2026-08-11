import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[90px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors",
        "placeholder:text-muted-foreground",
        "hover:border-secondary-300",
        "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
