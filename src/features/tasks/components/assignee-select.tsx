"use client";

import { useQueries } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { EmployeeWorkload } from "@/features/tasks/types/task.types";
import { AssigneeWorkloadHint } from "@/features/tasks/components/assignee-workload-hint";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type AssigneeOption = {
  id: string;
  fullName: string;
  employeeNumber?: string;
};

async function fetchWorkload(userId: string): Promise<EmployeeWorkload> {
  const response = await fetch(`/api/users/${userId}/workload`);
  const payload = (await response.json()) as {
    data?: EmployeeWorkload;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

type AssigneeSelectProps = {
  value: string | null | undefined;
  onChange: (userId: string) => void;
  options: AssigneeOption[];
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Show occupancy under the closed control (detail forms). Off by default for compact tables. */
  showSelectedHint?: boolean;
  /** Include employee number in labels */
  showEmployeeNumber?: boolean;
};

export function AssigneeSelect({
  value,
  onChange,
  options,
  disabled,
  id,
  className,
  showSelectedHint = false,
  showEmployeeNumber = false,
}: AssigneeSelectProps) {
  const t = useTranslations("tasks");

  const workloadQueries = useQueries({
    queries: options.map((option) => ({
      queryKey: ["workload", option.id],
      queryFn: () => fetchWorkload(option.id),
      staleTime: 30_000,
      enabled: !disabled && options.length > 0,
    })),
  });

  const workloadById = new Map<string, EmployeeWorkload>();
  options.forEach((option, index) => {
    const data = workloadQueries[index]?.data;
    if (data) {
      workloadById.set(option.id, data);
    }
  });

  function displayName(option: AssigneeOption): string {
    if (showEmployeeNumber && option.employeeNumber) {
      return `${option.fullName} (${option.employeeNumber})`;
    }
    return option.fullName;
  }

  function selectedLabel(selected: string | null): string {
    if (!selected) {
      return t("assignee");
    }
    const option = options.find((item) => item.id === selected);
    return option ? displayName(option) : t("assignee");
  }

  function optionListLabel(option: AssigneeOption): string {
    const name = displayName(option);
    const workload = workloadById.get(option.id);
    if (!workload) {
      return name;
    }
    return `${name} — ${t("workloadOptionCapacityLabel", {
      percent: Math.round(workload.capacityPercent),
      load: workload.estimatedHours,
      available: workload.availableHours,
    })}`;
  }

  return (
    <div
      className="space-y-1"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Select
        value={value ?? undefined}
        onValueChange={(next) => {
          if (next == null) {
            return;
          }
          onChange(String(next));
        }}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          size="sm"
          className={cn(
            "h-9 w-full min-w-0 max-w-full justify-between",
            className,
          )}
          aria-label={t("assignee")}
        >
          <SelectValue placeholder={t("assignee")}>
            {(selected) => (
              <span className="min-w-0 flex-1 truncate text-start">
                {selectedLabel(selected)}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          align="start"
          className="min-w-[14rem] max-w-[min(22rem,90vw)]"
        >
          {options.map((option) => (
            <SelectItem
              key={option.id}
              value={option.id}
              label={displayName(option)}
            >
              {optionListLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showSelectedHint ? (
        <AssigneeWorkloadHint userId={value} enabled={!disabled} />
      ) : null}
    </div>
  );
}
