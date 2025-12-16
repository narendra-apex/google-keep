import * as React from "react";

import { cn } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
};

export function Timeline({
  items,
  className,
}: {
  items: TimelineItem[];
  className?: string;
}) {
  return (
    <ol className={cn("relative border-l pl-4", className)}>
      {items.map((item) => (
        <li key={item.id} className="mb-6 ml-2">
          <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-primary" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{item.title}</div>
              {item.description ? (
                <div className="text-sm text-muted-foreground">
                  {item.description}
                </div>
              ) : null}
            </div>
            {item.timestamp ? (
              <time className="text-xs text-muted-foreground">
                {item.timestamp}
              </time>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
