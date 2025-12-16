import * as React from "react";

import { cn } from "@/lib/utils";

export type Step = {
  id: string;
  title: string;
  description?: string;
};

export function Stepper({
  steps,
  activeStepId,
  onSelect,
  className,
}: {
  steps: Step[];
  activeStepId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col gap-2", className)}>
      {steps.map((step, idx) => {
        const active = step.id === activeStepId;
        return (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => onSelect?.(step.id)}
              className={cn(
                "w-full rounded-md border px-3 py-2 text-left",
                active ? "border-primary bg-primary/5" : "bg-background"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    active ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  {idx + 1}
                </span>
                <div>
                  <div className="text-sm font-medium">{step.title}</div>
                  {step.description ? (
                    <div className="text-xs text-muted-foreground">
                      {step.description}
                    </div>
                  ) : null}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
