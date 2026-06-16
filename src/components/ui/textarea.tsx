import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm text-black/70 transition-colors placeholder:text-gray-400 placeholder:font-normal hover:border-gold-3/50 hover:text-black focus-visible:outline-none focus-visible:border-gold-3 focus-visible:ring-1 focus-visible:ring-gold-3/20 focus-visible:text-black disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
