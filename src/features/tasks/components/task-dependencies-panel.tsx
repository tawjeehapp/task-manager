"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type {
  Task,
  TaskDependency,
} from "@/features/tasks/types/task.types";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

type TaskDependenciesPanelProps = {
  taskId: string;
  projectId: string;
  /** null for root tasks; parent id for subtasks */
  parentTaskId?: string | null;
  canManage: boolean;
};

async function fetchDependencies(taskId: string): Promise<TaskDependency[]> {
  const response = await fetch(`/api/tasks/${taskId}/dependencies`);
  const payload = (await response.json()) as {
    data?: { items: TaskDependency[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!.items;
}

async function fetchDependencyCandidates(params: {
  projectId: string;
  parentTaskId: string | null;
}): Promise<Task[]> {
  const searchParams = new URLSearchParams({
    projectId: params.projectId,
    pageSize: "100",
    sortBy: "title",
    sortDir: "asc",
    parentTaskId: params.parentTaskId ?? "null",
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

export function TaskDependenciesPanel({
  taskId,
  projectId,
  parentTaskId = null,
  canManage,
}: TaskDependenciesPanelProps) {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [dependsOnTaskId, setDependsOnTaskId] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const scopeParentId = parentTaskId ?? null;

  const depsQuery = useQuery({
    queryKey: ["tasks", taskId, "dependencies"],
    queryFn: () => fetchDependencies(taskId),
  });

  const candidatesQuery = useQuery({
    queryKey: [
      "tasks",
      { projectId, parentTaskId: scopeParentId, forDependencies: true },
    ],
    queryFn: () =>
      fetchDependencyCandidates({
        projectId,
        parentTaskId: scopeParentId,
      }),
    enabled: canManage,
  });

  const addMutation = useMutation({
    mutationFn: async (dependsOn: string) => {
      const response = await fetch(`/api/tasks/${taskId}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependsOnTaskId: dependsOn }),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("dependencyAddFailed"));
      }
    },
    onSuccess: async () => {
      setDependsOnTaskId("");
      setSuccessMessage(t("dependencyAddSuccess"));
      await queryClient.invalidateQueries({
        queryKey: ["tasks", taskId, "dependencies"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["tasks", taskId, "activity"],
      });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (dependencyId: string) => {
      const response = await fetch(
        `/api/tasks/${taskId}/dependencies/${dependencyId}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("dependencyRemoveFailed"));
      }
    },
    onSuccess: async () => {
      setSuccessMessage(t("dependencyRemoveSuccess"));
      await queryClient.invalidateQueries({
        queryKey: ["tasks", taskId, "dependencies"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["tasks", taskId, "activity"],
      });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  if (depsQuery.isLoading) {
    return <LoadingState />;
  }

  if (depsQuery.isError) {
    return (
      <ErrorState
        title={tCommon("errorTitle")}
        description={(depsQuery.error as Error).message}
        onRetry={() => void depsQuery.refetch()}
      />
    );
  }

  const items = depsQuery.data ?? [];
  const existingIds = new Set(items.map((item) => item.dependsOnTaskId));
  const candidates = (candidatesQuery.data ?? []).filter(
    (task) => task.id !== taskId && !existingIds.has(task.id),
  );

  function statusLabel(status: string) {
    return t(`status_${status}` as "status_todo");
  }

  return (
    <div className="space-y-4">
      {successMessage ? (
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {canManage ? (
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (!dependsOnTaskId) {
              return;
            }
            addMutation.mutate(dependsOnTaskId);
          }}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="depends-on">{t("dependencyDependsOn")}</Label>
            <select
              id="depends-on"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={dependsOnTaskId}
              onChange={(event) => setDependsOnTaskId(event.target.value)}
              disabled={candidatesQuery.isLoading || addMutation.isPending}
            >
              <option value="">{t("dependencySelectTask")}</option>
              {candidates.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="submit"
            disabled={!dependsOnTaskId || addMutation.isPending}
          >
            {addMutation.isPending ? tCommon("saving") : t("dependencyAdd")}
          </Button>
        </form>
      ) : null}

      {addMutation.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {(addMutation.error as Error).message}
          </AlertDescription>
        </Alert>
      ) : null}

      {removeMutation.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {(removeMutation.error as Error).message}
          </AlertDescription>
        </Alert>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title={t("dependenciesEmptyTitle")}
          description={t("dependenciesEmptyDescription")}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("dependencyDependsOn")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                {canManage ? <TableHead>{t("actions")}</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const incomplete =
                  item.dependsOnTask?.status !== "completed";
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.dependsOnTask ? (
                        <Link
                          href={`/tasks/${item.dependsOnTaskId}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {item.dependsOnTask.title}
                        </Link>
                      ) : (
                        item.dependsOnTaskId
                      )}
                      {incomplete ? (
                        <Badge className="ms-2" variant="secondary">
                          {t("dependencyBlocking")}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {item.dependsOnTask
                        ? statusLabel(item.dependsOnTask.status)
                        : "—"}
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={removeMutation.isPending}
                          onClick={() => removeMutation.mutate(item.id)}
                        >
                          {t("dependencyRemove")}
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
