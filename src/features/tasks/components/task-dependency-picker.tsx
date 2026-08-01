"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { Task } from "@/features/tasks/types/task.types";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

async function fetchDependencyCandidates(projectId: string): Promise<Task[]> {
  const searchParams = new URLSearchParams({
    projectId,
    pageSize: "100",
    sortBy: "title",
    sortDir: "asc",
  });
  const response = await fetch(`/api/tasks?${searchParams.toString()}`);
  const payload = (await response.json()) as {
    data?: { items: Task[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!.items;
}

type TaskDependencyPickerProps = {
  projectId: string | null | undefined;
  value: string[];
  onChange: (ids: string[]) => void;
  excludeTaskIds?: string[];
  disabled?: boolean;
  className?: string;
};

export function TaskDependencyPicker({
  projectId,
  value,
  onChange,
  excludeTaskIds = [],
  disabled,
  className,
}: TaskDependencyPickerProps) {
  const t = useTranslations("tasks");
  const exclude = new Set(excludeTaskIds);

  const tasksQuery = useQuery({
    queryKey: ["tasks", { projectId, forDependencyPicker: true }],
    queryFn: () => fetchDependencyCandidates(projectId!),
    enabled: Boolean(projectId),
  });

  if (!projectId) {
    return (
      <p className="text-muted-foreground text-xs">{t("dependencyNeedProject")}</p>
    );
  }

  const candidates = (tasksQuery.data ?? []).filter(
    (task) => !exclude.has(task.id),
  );

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((item) => item !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{t("dependencyDependsOn")}</Label>
      <p className="text-muted-foreground text-xs">
        {t("dependencyPickerHint")}
      </p>
      {tasksQuery.isLoading ? (
        <p className="text-muted-foreground text-xs">{t("workloadLoading")}</p>
      ) : null}
      {candidates.length === 0 && !tasksQuery.isLoading ? (
        <p className="text-muted-foreground text-xs">
          {t("dependencyPickerEmpty")}
        </p>
      ) : (
        <div className="border-input max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
          {candidates.map((task) => {
            const checked = value.includes(task.id);
            return (
              <label
                key={task.id}
                className="hover:bg-muted flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(task.id)}
                />
                <span className="min-w-0 truncate font-medium">{task.title}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
