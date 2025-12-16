"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function Drawer({
  open,
  onOpenChange,
  title,
  children,
  side = "right",
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  side?: "right" | "left";
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
      <div
        className={cn(
          "absolute inset-y-0 w-full max-w-xl bg-background shadow-xl",
          side === "right" ? "right-0" : "left-0",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex h-full flex-col">
          <div className="border-b p-4">
            <div className="text-sm font-semibold">{title}</div>
          </div>
          <div className="flex-1 overflow-auto p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
