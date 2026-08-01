"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { Task, TaskStatus } from "@/features/tasks/types/task.types";

type BoardStatusVars = {
  taskId: string;
  status: TaskStatus;
};

function applyStatus(tasks: Task[], taskId: string, status: TaskStatus): Task[] {
  return tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          status,
          completedAt:
            status === "completed" ? new Date().toISOString() : null,
        }
      : task,
  );
}

/**
 * PATCH task status with an immediate board cache update, then reconcile.
 */
export function useBoardStatusMutation(queryKey: readonly unknown[]) {
  const t = useTranslations("tasks");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, status }: BoardStatusVars) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("updateFailed"));
      }
    },
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Task[]>(queryKey);
      queryClient.setQueryData<Task[]>(queryKey, (current) =>
        applyStatus(current ?? [], taskId, status),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
