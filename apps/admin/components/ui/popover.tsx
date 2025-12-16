"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function Popover({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative inline-block", className)}>{children}</div>;
}

export function PopoverTrigger({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "z-50 rounded-md border bg-popover p-4 text-popover-foreground shadow-md",
      className
    )}
    {...props}
  />
));
PopoverContent.displayName = "PopoverContent";
