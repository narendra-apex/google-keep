"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastContextValue = {
  toast: (t: Omit<Toast, "id">) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((t: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next: Toast = { id, variant: "default", ...t };
    setToasts((prev) => [...prev, next]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed right-4 top-4 z-[60] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-lg border bg-background p-3 shadow-md",
              t.variant === "success" && "border-emerald-200",
              t.variant === "error" && "border-red-200"
            )}
          >
            <div className="text-sm font-semibold">{t.title}</div>
            {t.description ? (
              <div className="text-sm text-muted-foreground">{t.description}</div>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
