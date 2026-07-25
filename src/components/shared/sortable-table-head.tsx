"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SortDirection } from "@/lib/table/constants";

type SortableTableHeadProps = {
  label: string;
  column: string;
  sortBy: string;
  sortDir: SortDirection;
  onSort: (column: string) => void;
  className?: string;
};

export function SortableTableHead({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
  className,
}: SortableTableHeadProps) {
  const active = sortBy === column;
  return (
    <th
      className={cn(
        "h-10 px-2 text-start align-middle font-medium whitespace-nowrap text-foreground",
        className,
      )}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1.5 hover:text-foreground"
        onClick={() => onSort(column)}
      >
        <span>{label}</span>
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ArrowUpDown className="size-3.5 opacity-40" />
        )}
      </button>
    </th>
  );
}
