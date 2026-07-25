"use client";

import { useQueries } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { EmployeeWorkload } from "@/features/tasks/types/task.types";
import { AssigneeWorkloadHint } from "@/features/tasks/components/assignee-workload-hint";
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
  onChange: (userId: string | null) => void;
  options: AssigneeOption[];
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Show compact occupancy under the select for the current value */
  showSelectedHint?: boolean;
  /** Include employee number in the option label */
  showEmployeeNumber?: boolean;
};

export function AssigneeSelect({
  value,
  onChange,
  options,
  disabled,
  id,
  className,
  showSelectedHint = true,
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

  function optionLabel(option: AssigneeOption): string {
    const base = showEmployeeNumber && option.employeeNumber
      ? `${option.fullName} (${option.employeeNumber})`
      : option.fullName;
    const workload = workloadById.get(option.id);
    if (!workload) {
      return base;
    }
    return `${base} — ${t("workloadOptionLabel", {
      count: workload.activeTaskCount,
      hours: workload.estimatedHours,
    })}`;
  }

  return (
    <div className="space-y-1">
      <select
        id={id}
        className={cn(
          "border-input bg-background h-9 w-full rounded-md border px-3 text-sm",
          className,
        )}
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next ? next : null);
        }}
        aria-label={t("assignee")}
      >
        <option value="">{t("unassigned")}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
      {showSelectedHint ? (
        <AssigneeWorkloadHint userId={value} enabled={!disabled} />
      ) : null}
    </div>
  );
}
