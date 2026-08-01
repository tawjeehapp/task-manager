"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { Task, TaskStatus } from "@/features/tasks/types/task.types";
import { TASK_STATUSES } from "@/features/tasks/types/task.types";
import type { Project } from "@/features/projects/types/project.types";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type ProjectBoardClientProps = {
  projectId: string;
  canUpdateStatus: boolean;
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "bg-muted",
  in_progress: "bg-sky-500/10 border-sky-500/30",
  blocked: "bg-orange-500/10 border-orange-500/30",
  completed: "bg-emerald-500/10 border-emerald-500/30",
};

async function fetchProject(id: string): Promise<Project> {
  const response = await fetch(`/api/projects/${id}`);
  const payload = (await response.json()) as {
    data?: Project;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

async function fetchBoardTasks(projectId: string): Promise<Task[]> {
  const params = new URLSearchParams({
    projectId,
    pageSize: "100",
    sortBy: "createdAt",
    sortDir: "asc",
  });
  const response = await fetch(`/api/tasks?${params.toString()}`);
  const payload = (await response.json()) as {
    data?: { items: Task[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!.items;
}

export function ProjectBoardClient({
  projectId,
  canUpdateStatus,
}: ProjectBoardClientProps) {
  const t = useTranslations("tasks");
  const tProjects = useTranslations("projects");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const projectQuery = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => fetchProject(projectId),
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks", "board", projectId],
    queryFn: () => fetchBoardTasks(projectId),
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      taskId,
      status,
    }: {
      taskId: string;
      status: TaskStatus;
    }) => {
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
    onSuccess: async () => {
      setSuccessMessage(t("statusUpdateSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const boardTasks = tasksQuery.data ?? [];

  const columns = useMemo(() => {
    return TASK_STATUSES.map((status) => ({
      status,
      tasks: boardTasks.filter((task) => task.status === status),
    }));
  }, [boardTasks]);

  function statusLabel(status: TaskStatus) {
    return t(`status_${status}` as "status_todo");
  }

  if (projectQuery.isLoading || tasksQuery.isLoading) {
    return <LoadingState />;
  }

  if (projectQuery.isError || tasksQuery.isError) {
    return (
      <ErrorState
        title={tCommon("errorTitle")}
        description={
          (projectQuery.error as Error)?.message ??
          (tasksQuery.error as Error)?.message
        }
        onRetry={() => {
          void projectQuery.refetch();
          void tasksQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { label: tProjects("title"), href: "/projects" },
            {
              label: projectQuery.data?.name ?? projectId,
              href: `/projects/${projectId}`,
            },
            { label: tProjects("kanban") },
          ]}
        />
        <PageHeader
          title={tProjects("kanban")}
          description={tProjects("kanbanDescription")}
        />
      </div>

      {successMessage ? (
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {statusMutation.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {(statusMutation.error as Error).message}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((column) => (
          <div
            key={column.status}
            className={cn(
              "min-w-[220px] flex-1 rounded-lg border p-3",
              STATUS_COLORS[column.status],
            )}
            onDragOver={(event) => {
              if (canUpdateStatus) {
                event.preventDefault();
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!canUpdateStatus || !draggingId) {
                return;
              }
              const task = boardTasks.find((item) => item.id === draggingId);
              if (
                task &&
                task.status !== column.status &&
                !(task.incompleteDependencyCount ?? 0)
              ) {
                statusMutation.mutate({
                  taskId: draggingId,
                  status: column.status,
                });
              }
              setDraggingId(null);
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {statusLabel(column.status)}
              </h3>
              <Badge variant="secondary">{column.tasks.length}</Badge>
            </div>
            <div className="space-y-2">
              {column.tasks.map((task) => {
                const statusLocked = (task.incompleteDependencyCount ?? 0) > 0;
                const canDrag = canUpdateStatus && !statusLocked;
                return (
                  <div
                    key={task.id}
                    draggable={canDrag}
                    onDragStart={() => {
                      if (canDrag) {
                        setDraggingId(task.id);
                      }
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    title={
                      statusLocked
                        ? t("statusLockedByDependencies")
                        : undefined
                    }
                    className={cn(
                      "rounded-md border bg-background p-3 shadow-sm",
                      canDrag && "cursor-grab active:cursor-grabbing",
                      statusLocked && "opacity-80",
                      draggingId === task.id && "opacity-60",
                    )}
                  >
                    <Link
                      href={`/tasks/${task.id}`}
                      className="min-w-0 flex-1 font-medium underline-offset-4 hover:underline"
                      onClick={(event) => {
                        if (draggingId) {
                          event.preventDefault();
                        }
                      }}
                    >
                      {task.title}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <p className="text-muted-foreground text-xs">
                        {task.assignee?.fullName ?? t("unassigned")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
