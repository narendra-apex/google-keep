"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function Modal({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={cn(
            "w-full max-w-lg rounded-lg border bg-background p-4 shadow-lg",
            className
          )}
          role="dialog"
          aria-modal="true"
        >
          {title ? <div className="mb-3 text-sm font-semibold">{title}</div> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
