import * as React from "react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "destructive" | "outline";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variant === "default" && "bg-muted text-foreground border-transparent",
        variant === "success" && "bg-emerald-50 text-emerald-800 border-emerald-200",
        variant === "warning" && "bg-amber-50 text-amber-800 border-amber-200",
        variant === "destructive" &&
          "bg-red-50 text-red-800 border-red-200",
        variant === "outline" && "bg-transparent text-foreground",
        className
      )}
      {...props}
    />
  );
}
