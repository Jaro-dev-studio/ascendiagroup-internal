import * as React from "react";

import { cn } from "@/lib/utils";

interface InputProps extends React.ComponentProps<"input"> {
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors",
            "placeholder:text-muted-foreground",
            "hover:border-secondary-300",
            "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            icon && "pl-9",
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
