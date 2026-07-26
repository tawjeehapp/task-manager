"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import type { Task, TaskStatus } from "@/features/tasks/types/task.types";
import { TASK_STATUSES } from "@/features/tasks/types/task.types";
import type { TasksListResult } from "@/features/tasks/services/tasks";
import { todayInOrgTimezone } from "@/lib/org-calendar";
import { formatDate } from "@/lib/dates";
import { withInitialData } from "@/lib/query/initial-data";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type EmployeeTasksBoardProps = {
  viewerId: string;
  initialTasks: TasksListResult;
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "border-t-4 border-t-muted-foreground/40 bg-muted/20",
  in_progress: "border-t-4 border-t-sky-500 bg-sky-500/5",
  blocked: "border-t-4 border-t-orange-500 bg-orange-500/5",
  completed: "border-t-4 border-t-emerald-500 bg-emerald-500/5",
};

async function fetchMyTasks(viewerId: string): Promise<Task[]> {
  const params = new URLSearchParams({
    page: "1",
    pageSize: "100",
    sortBy: "dueDate",
    sortDir: "asc",
    parentTaskId: "null",
    assignee: viewerId,
  });
  const response = await fetch(`/api/tasks?${params.toString()}`);
  const payload = (await response.json()) as {
    data?: TasksListResult;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data?.items ?? [];
}

export function isLateTask(task: Task, today: string): boolean {
  return (
    task.status !== "completed" &&
    task.dueDate != null &&
    task.dueDate < today
  );
}

export function filterEmployeeBoardTasks(
  tasks: Task[],
  opts: {
    search: string;
    status: string;
    priority: string;
    lateOnly: boolean;
    today: string;
  },
): Task[] {
  const q = opts.search.trim().toLowerCase();
  return tasks.filter((task) => {
    if (opts.status && task.status !== opts.status) return false;
    if (opts.priority && task.priority !== opts.priority) return false;
    if (opts.lateOnly && !isLateTask(task, opts.today)) return false;
    if (q) {
      const hay = `${task.title} ${task.project?.name ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function EmployeeTasksBoard({
  viewerId,
  initialTasks,
}: EmployeeTasksBoardProps) {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [lateOnly, setLateOnly] = useState(false);
  const today = todayInOrgTimezone();

  const tasksQuery = useQuery({
    queryKey: ["tasks", "employee-board", viewerId],
    queryFn: () => fetchMyTasks(viewerId),
    ...withInitialData(initialTasks.items),
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

  const filtered = useMemo(
    () =>
      filterEmployeeBoardTasks(tasksQuery.data ?? [], {
        search,
        status: statusFilter,
        priority: priorityFilter,
        lateOnly,
        today,
      }),
    [
      tasksQuery.data,
      search,
      statusFilter,
      priorityFilter,
      lateOnly,
      today,
    ],
  );

  const columns = useMemo(() => {
    return TASK_STATUSES.map((status) => ({
      status,
      tasks: filtered.filter((task) => task.status === status),
    }));
  }, [filtered]);

  function statusLabel(status: TaskStatus) {
    return t(`status_${status}` as "status_todo");
  }

  if (tasksQuery.isLoading) {
    return <LoadingState />;
  }

  if (tasksQuery.isError) {
    return (
      <ErrorState
        title={tCommon("errorTitle")}
        description={(tasksQuery.error as Error).message}
        onRetry={() => void tasksQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("myTasksTitle")}
        description={t("myTasksDescription")}
      />
      <p className="text-xs text-muted-foreground">{t("assignedToMeLabel")}</p>

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

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchTasks")}
            className="ps-8"
          />
        </div>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={t("status")}
        >
          <option value="">{t("filterAllStatuses")}</option>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          aria-label={t("priority")}
        >
          <option value="">{t("filterAllPriorities")}</option>
          <option value="low">{t("priority_low")}</option>
          <option value="medium">{t("priority_medium")}</option>
          <option value="high">{t("priority_high")}</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={lateOnly}
            onChange={(e) => setLateOnly(e.target.checked)}
          />
          {t("lateOnly")}
        </label>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((column) => (
          <div
            key={column.status}
            className={cn(
              "min-w-[220px] flex-1 rounded-lg border p-3",
              STATUS_COLORS[column.status],
            )}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!draggingId) return;
              const task = filtered.find((item) => item.id === draggingId);
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
              {column.tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("boardColumnEmpty")}
                </p>
              ) : null}
              {column.tasks.map((task) => {
                const statusLocked = (task.incompleteDependencyCount ?? 0) > 0;
                const late = isLateTask(task, today);
                return (
                  <div
                    key={task.id}
                    draggable={!statusLocked}
                    onDragStart={() => {
                      if (!statusLocked) setDraggingId(task.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    title={
                      statusLocked
                        ? t("statusLockedByDependencies")
                        : undefined
                    }
                    className={cn(
                      "rounded-md border bg-background p-3 shadow-sm",
                      !statusLocked && "cursor-grab active:cursor-grabbing",
                      statusLocked && "opacity-80",
                      draggingId === task.id && "opacity-60",
                      late && "border-destructive/40",
                    )}
                  >
                    <Link
                      href={`/tasks/${task.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                      onClick={(event) => {
                        if (draggingId) event.preventDefault();
                      }}
                    >
                      {task.title}
                    </Link>
                    <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                      {task.project?.name ? <p>{task.project.name}</p> : null}
                      {task.dueDate ? (
                        <p className={cn(late && "text-destructive")}>
                          {formatDate(task.dueDate)}
                        </p>
                      ) : null}
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
