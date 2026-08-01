"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { DashboardTaskItem } from "@/features/dashboard/types/dashboard.types";
import type { TaskStatus } from "@/features/tasks/types/task.types";
import { selectableTaskStatuses } from "@/features/tasks/types/task.types";
import { cn } from "@/lib/utils";

const selectClassName =
  "border-input bg-background h-8 w-full min-w-[7.5rem] max-w-[10rem] rounded-md border px-2 text-sm";

async function patchTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const payload = (await response.json()) as {
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
}

function isTaskLikeList(
  data: unknown,
): data is Array<{ id: string; status: string }> {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    typeof data[0] === "object" &&
    data[0] != null &&
    "id" in data[0] &&
    "status" in data[0]
  );
}

type DashboardTaskStatusSelectProps = {
  task: DashboardTaskItem;
  className?: string;
  /** Extra optimistic update for lists not held in the tasks query cache. */
  onOptimisticChange?: (taskId: string, status: TaskStatus) => void;
  onOptimisticRollback?: (taskId: string, previousStatus: string) => void;
  onError?: (message: string) => void;
};

export function DashboardTaskStatusSelect({
  task,
  className,
  onOptimisticChange,
  onOptimisticRollback,
  onError,
}: DashboardTaskStatusSelectProps) {
  const t = useTranslations("dashboard");
  const tTasks = useTranslations("tasks");
  const queryClient = useQueryClient();
  const statusLocked = (task.incompleteDependencyCount ?? 0) > 0;

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) => patchTaskStatus(task.id, status),
    onMutate: async (status) => {
      const previousStatus = task.status;
      onOptimisticChange?.(task.id, status);

      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousEntries = queryClient.getQueriesData({
        queryKey: ["tasks"],
      });

      for (const [key, data] of previousEntries) {
        if (!isTaskLikeList(data)) continue;
        queryClient.setQueryData(
          key,
          data.map((item) =>
            item.id === task.id ? { ...item, status } : item,
          ),
        );
      }

      return { previousStatus, previousEntries };
    },
    onError: (error, _status, context) => {
      if (context?.previousStatus) {
        onOptimisticRollback?.(task.id, context.previousStatus);
      }
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          queryClient.setQueryData(key, data);
        }
      }
      onError?.(
        error instanceof Error ? error.message : tTasks("updateFailed"),
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  function statusLabel(status: string) {
    return t(`status_${status}` as
      | "status_todo"
      | "status_in_progress"
      | "status_blocked"
      | "status_completed");
  }

  return (
    <select
      className={cn(selectClassName, className)}
      value={task.status}
      disabled={statusMutation.isPending || statusLocked}
      title={
        statusLocked ? tTasks("statusLockedByDependencies") : undefined
      }
      aria-label={t("colStatus")}
      onChange={(event) =>
        statusMutation.mutate(event.target.value as TaskStatus)
      }
    >
      {selectableTaskStatuses(task.status as TaskStatus).map((status) => (
        <option key={status} value={status}>
          {statusLabel(status)}
        </option>
      ))}
    </select>
  );
}
