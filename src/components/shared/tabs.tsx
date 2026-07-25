"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TabItem = {
  id: string;
  label: string;
  /** Optional count badge next to the label */
  count?: number;
};

type TabsProps = {
  items: TabItem[];
  value: string;
  onValueChange: (id: string) => void;
  children: ReactNode;
  className?: string;
  /** Actions rendered on the trailing side of the tab list (e.g. Add member) */
  actions?: ReactNode;
};

type TabPanelProps = {
  when: string;
  active: string;
  children: ReactNode;
  className?: string;
};

export function Tabs({
  items,
  value,
  onValueChange,
  children,
  className,
  actions,
}: TabsProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          className="flex gap-1 overflow-x-auto"
        >
          {items.map((item) => {
            const selected = item.id === value;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                id={`tab-${item.id}`}
                className={cn(
                  "relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors",
                  selected
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => onValueChange(item.id)}
              >
                <span className="inline-flex items-center gap-2">
                  {item.label}
                  {typeof item.count === "number" ? (
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-xs tabular-nums",
                        selected
                          ? "bg-primary/10 text-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </span>
                {selected ? (
                  <span className="bg-primary absolute inset-x-0 bottom-0 h-0.5 rounded-full" />
                ) : null}
              </button>
            );
          })}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 pb-2 sm:pb-0">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function TabPanel({ when, active, children, className }: TabPanelProps) {
  if (when !== active) {
    return null;
  }
  return (
    <div
      role="tabpanel"
      id={`panel-${when}`}
      aria-labelledby={`tab-${when}`}
      className={className}
    >
      {children}
    </div>
  );
}
