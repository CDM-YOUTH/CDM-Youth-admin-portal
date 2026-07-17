import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-xl border border-border bg-white px-3.5 py-2 text-[14px] text-foreground transition-colors placeholder:text-text-4 hover:border-gold-3/50 focus-visible:outline-none focus-visible:border-gold-3 focus-visible:ring-1 focus-visible:ring-gold-3/20 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
