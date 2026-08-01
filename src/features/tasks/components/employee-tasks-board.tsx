"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Calendar, Lock, Search, TriangleAlert } from "lucide-react";

import type {
  Task,
  TaskPriority,
  TaskStatus,
} from "@/features/tasks/types/task.types";
import { TASK_STATUSES } from "@/features/tasks/types/task.types";
import type { TasksListResult } from "@/features/tasks/services/tasks";
import { TaskRequestDialog } from "@/features/dashboard/components/task-request-dialog";
import { TaskBlockerChips } from "@/features/tasks/components/task-blocker-summary";
import {
  AssigneeSelect,
  type AssigneeOption,
} from "@/features/tasks/components/assignee-select";
import { useBoardStatusMutation } from "@/features/tasks/hooks/use-board-status-mutation";
import { todayInOrgTimezone } from "@/lib/org-calendar";
import { formatDate } from "@/lib/dates";
import { withInitialData } from "@/lib/query/initial-data";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type EmployeeTasksBoardProps = {
  viewerId: string;
  initialTasks: TasksListResult;
  /** Personal = assignee-filtered board; team = department-wide board. */
  mode?: "personal" | "team";
  /** When true, parent owns the page header (e.g. list/board toggle). */
  hideHeader?: boolean;
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "border-t-4 border-t-violet-500 bg-violet-500/5",
  in_progress: "border-t-4 border-t-amber-500 bg-amber-500/5",
  blocked: "border-t-4 border-t-muted-foreground/40 bg-muted/20",
  completed: "border-t-4 border-t-emerald-500 bg-emerald-500/5",
};

const STATUS_BADGE_COLORS: Record<TaskStatus, string> = {
  todo: "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300",
  in_progress:
    "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300",
  blocked: "border-muted-foreground/30 bg-muted text-muted-foreground",
  completed:
    "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

async function fetchMyTasks(viewerId: string): Promise<Task[]> {
  const params = new URLSearchParams({
    page: "1",
    pageSize: "100",
    sortBy: "dueDate",
    sortDir: "asc",
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

async function fetchTeamTasks(): Promise<Task[]> {
  const params = new URLSearchParams({
    page: "1",
    pageSize: "100",
    sortBy: "dueDate",
    sortDir: "asc",
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

export function isDueTodayTask(task: Task, today: string): boolean {
  return (
    task.status !== "completed" &&
    task.dueDate != null &&
    task.dueDate === today
  );
}

const CARD_DATE_FORMAT = "D MMMM";

export function formatCardDate(value: string): string {
  return formatDate(value, CARD_DATE_FORMAT);
}

export function formatTaskDateRange(task: Task): string | null {
  if (task.dueDate) return formatCardDate(task.dueDate);
  return null;
}

export function filterEmployeeBoardTasks(
  tasks: Task[],
  opts: {
    search: string;
    status: string;
    priority: string;
    assignee?: string;
    lateOnly: boolean;
    today: string;
  },
): Task[] {
  const q = opts.search.trim().toLowerCase();
  return tasks.filter((task) => {
    if (opts.status && task.status !== opts.status) return false;
    if (opts.priority && task.priority !== opts.priority) return false;
    if (opts.assignee === "__unassigned__") {
      if (task.assignedTo) return false;
    } else if (opts.assignee && task.assignedTo !== opts.assignee) {
      return false;
    }
    if (opts.lateOnly && !isLateTask(task, opts.today)) return false;
    if (q) {
      const hay =
        `${task.title} ${task.project?.name ?? ""} ${task.assignee?.fullName ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function PriorityPill({
  priority,
  label,
}: {
  priority: string;
  label: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-normal",
        priority === "high" &&
          "border-destructive/30 bg-destructive/10 text-destructive",
        priority === "medium" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        priority === "low" && "text-muted-foreground",
      )}
    >
      {label}
    </Badge>
  );
}

const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

const boardFieldClassName =
  "border-input bg-background h-8 w-full rounded-md border px-2 text-xs";

async function fetchAssigneeOptions(
  projectId: string,
  departmentId: string | null | undefined,
): Promise<AssigneeOption[]> {
  const requests: Promise<Response>[] = [
    fetch(`/api/projects/${projectId}/members`),
  ];
  if (departmentId) {
    requests.push(fetch(`/api/departments/${departmentId}/members`));
  }

  const responses = await Promise.all(requests);
  const byId = new Map<string, AssigneeOption>();

  for (const response of responses) {
    const payload = (await response.json()) as {
      data?: {
        items: Array<{
          user?: { id: string; fullName: string; employeeNumber?: string };
        }>;
      };
    };
    if (!response.ok) continue;
    for (const member of payload.data?.items ?? []) {
      const user = member.user;
      if (!user) continue;
      byId.set(user.id, {
        id: user.id,
        fullName: user.fullName,
        employeeNumber: user.employeeNumber,
      });
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );
}

async function patchTask(
  taskId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
}

function TeamBoardTaskCard({
  task,
  today,
}: {
  task: Task;
  today: string;
}) {
  const t = useTranslations("tasks");
  const tDashboard = useTranslations("dashboard");
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const late = isLateTask(task, today);
  const dueToday = isDueTodayTask(task, today);
  const isCompleted = task.status === "completed";

  const membersQuery = useQuery({
    queryKey: [
      "task-assignees",
      task.projectId,
      task.project?.departmentId,
    ],
    queryFn: () =>
      fetchAssigneeOptions(task.projectId, task.project?.departmentId),
    staleTime: 60_000,
  });

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => patchTask(task.id, body),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => {
      setError(err.message || t("inlineSaveFailed"));
    },
  });

  function priorityLabel(priority: string) {
    return t(`priority_${priority}` as "priority_low");
  }

  const assigneeOptions = useMemo(() => {
    const options = [...(membersQuery.data ?? [])];
    if (
      task.assignedTo &&
      !options.some((member) => member.id === task.assignedTo)
    ) {
      options.push({
        id: task.assignedTo,
        fullName: task.assignee?.fullName ?? task.assignedTo,
      });
    }
    return options;
  }, [membersQuery.data, task.assignedTo, task.assignee?.fullName]);

  return (
    <div
      className={cn(
        "rounded-md border bg-background p-3 shadow-sm",
        late && "border-destructive/40",
      )}
    >
      {task.project?.name ? (
        <p className="text-xs text-muted-foreground">{task.project.name}</p>
      ) : null}
      <Link
        href={`/tasks/${task.id}`}
        className="mt-0.5 block font-medium underline-offset-4 hover:underline"
      >
        {task.title}
      </Link>

      <div className="mt-2 space-y-2">
        <AssigneeSelect
          className={boardFieldClassName}
          value={task.assignedTo}
          disabled={patchMutation.isPending || membersQuery.isLoading}
          options={assigneeOptions}
          onChange={(userId) => patchMutation.mutate({ assignedTo: userId })}
        />
        <select
          className={boardFieldClassName}
          value={task.priority}
          disabled={patchMutation.isPending}
          aria-label={t("priority")}
          onChange={(event) =>
            patchMutation.mutate({ priority: event.target.value })
          }
        >
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priorityLabel(priority)}
            </option>
          ))}
        </select>
        <Input
          type="date"
          className={cn(boardFieldClassName, late || dueToday ? "text-destructive" : "")}
          defaultValue={task.dueDate ?? ""}
          disabled={patchMutation.isPending}
          aria-label={t("dueDate")}
          onBlur={(event) => {
            const next = event.target.value || null;
            if (next === task.dueDate) return;
            patchMutation.mutate({ dueDate: next });
          }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {isCompleted ? (
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 font-normal text-emerald-700 dark:text-emerald-300"
          >
            {t("status_completed")}
          </Badge>
        ) : null}
        {late && task.dueDate ? (
          <span className="text-xs font-medium text-destructive">
            {t("boardLateWithDate", {
              date: formatCardDate(task.dueDate),
            })}
          </span>
        ) : null}
        {dueToday ? (
          <span className="text-xs font-medium text-destructive">
            {tDashboard("dueTodayLabel")}
          </span>
        ) : null}
      </div>

      <TaskBlockerChips
        blockers={task.incompleteDependencies ?? []}
        allowOpenTask={false}
      />

      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

export function EmployeeTasksBoard({
  viewerId,
  initialTasks,
  mode = "personal",
  hideHeader = false,
}: EmployeeTasksBoardProps) {
  const t = useTranslations("tasks");
  const tDashboard = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const isTeam = mode === "team";
  const [boardNotice, setBoardNotice] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [lateOnly, setLateOnly] = useState(false);
  const [requestTask, setRequestTask] = useState<Pick<
    Task,
    "id" | "title" | "dueDate"
  > | null>(null);
  const today = todayInOrgTimezone();
  const boardQueryKey = (
    isTeam
      ? (["tasks", "team-board"] as const)
      : (["tasks", "employee-board", viewerId] as const)
  );

  const tasksQuery = useQuery({
    queryKey: boardQueryKey,
    queryFn: () => (isTeam ? fetchTeamTasks() : fetchMyTasks(viewerId)),
    ...withInitialData(initialTasks.items),
  });

  const statusMutation = useBoardStatusMutation(boardQueryKey);
  const filtered = useMemo(
    () =>
      filterEmployeeBoardTasks(tasksQuery.data ?? [], {
        search,
        status: statusFilter,
        priority: priorityFilter,
        assignee: isTeam ? assigneeFilter : undefined,
        lateOnly,
        today,
      }),
    [
      tasksQuery.data,
      search,
      statusFilter,
      priorityFilter,
      assigneeFilter,
      isTeam,
      lateOnly,
      today,
    ],
  );

  const assigneeFilterOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const task of tasksQuery.data ?? []) {
      if (task.assignedTo) {
        byId.set(
          task.assignedTo,
          task.assignee?.fullName ?? task.assignedTo,
        );
      }
    }
    return [...byId.entries()]
      .map(([id, fullName]) => ({ id, fullName }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"));
  }, [tasksQuery.data]);

  const columns = useMemo(() => {
    return TASK_STATUSES.map((status) => ({
      status,
      tasks: filtered.filter((task) => task.status === status),
    }));
  }, [filtered]);

  function statusLabel(status: TaskStatus) {
    return t(`status_${status}` as "status_todo");
  }

  function priorityLabel(priority: string) {
    return t(`priority_${priority}` as "priority_low");
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
      {!hideHeader ? (
        <>
          <PageHeader
            title={isTeam ? t("teamTasksTitle") : t("myTasksTitle")}
            description={
              isTeam ? t("teamTasksDescription") : t("myTasksDescription")
            }
          />
          {!isTeam ? (
            <p className="text-xs text-muted-foreground">
              {t("assignedToMeLabel")}
            </p>
          ) : null}
        </>
      ) : null}

      {boardNotice ? (
        <Alert variant="destructive">
          <AlertDescription>{boardNotice}</AlertDescription>
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
        {isTeam ? (
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            aria-label={t("assignee")}
          >
            <option value="">{t("filterAllAssignees")}</option>
            <option value="__unassigned__">{t("unassigned")}</option>
            {assigneeFilterOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.fullName}
              </option>
            ))}
          </select>
        ) : null}
        <label
          className={cn(
            "flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm",
            lateOnly && "border-destructive/40 bg-destructive/5",
          )}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={lateOnly}
            onChange={(e) => setLateOnly(e.target.checked)}
          />
          <TriangleAlert
            className={cn(
              "size-3.5 shrink-0",
              lateOnly ? "text-destructive" : "text-muted-foreground",
            )}
            aria-hidden
          />
          <span className={cn(lateOnly && "text-destructive")}>
            {t("lateOnly")}
          </span>
        </label>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((column) => {
          const isBlockedColumn = column.status === "blocked";
          const isDropTarget = !isTeam && dropTarget === column.status;
          const showBlockedHint =
            !isTeam && Boolean(draggingId) && isBlockedColumn;

          return (
          <div
            key={column.status}
            className={cn(
              "min-w-[260px] flex-1 rounded-lg border p-3 transition-shadow",
              STATUS_COLORS[column.status],
              isDropTarget &&
                !isBlockedColumn &&
                "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
              isDropTarget &&
                isBlockedColumn &&
                "ring-2 ring-destructive/40 ring-offset-2 ring-offset-background",
            )}
            onDragOver={
              isTeam
                ? undefined
                : (event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = isBlockedColumn
                      ? "none"
                      : "move";
                    setDropTarget(column.status);
                  }
            }
            onDrop={
              isTeam
                ? undefined
                : (event) => {
                    event.preventDefault();
                    const taskId = draggingId;
                    setDraggingId(null);
                    setDropTarget(null);
                    if (!taskId) return;

                    if (isBlockedColumn) {
                      setBoardNotice(t("boardBlockedDropDenied"));
                      return;
                    }

                    const task = filtered.find((item) => item.id === taskId);
                    if (
                      task &&
                      task.status !== column.status &&
                      !(task.incompleteDependencyCount ?? 0)
                    ) {
                      setBoardNotice(null);
                      statusMutation.mutate({
                        taskId,
                        status: column.status,
                      });
                    }
                  }
            }
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {statusLabel(column.status)}
              </h3>
              <Badge
                variant="outline"
                className={cn(
                  "min-w-6 justify-center tabular-nums",
                  STATUS_BADGE_COLORS[column.status],
                )}
              >
                {column.tasks.length}
              </Badge>
            </div>
            {isBlockedColumn ? (
              <p
                className={cn(
                  "mb-2 flex items-start gap-1.5 text-xs text-muted-foreground",
                  showBlockedHint && "font-medium text-destructive",
                )}
              >
                <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
                <span>{t("boardBlockedColumnHint")}</span>
              </p>
            ) : null}
            <div className="space-y-2">
              {column.tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("boardColumnEmpty")}
                </p>
              ) : null}
              {column.tasks.map((task) => {
                if (isTeam) {
                  return (
                    <TeamBoardTaskCard
                      key={task.id}
                      task={task}
                      today={today}
                    />
                  );
                }

                const statusLocked = (task.incompleteDependencyCount ?? 0) > 0;
                const late = isLateTask(task, today);
                const dueToday = isDueTodayTask(task, today);
                const isCompleted = task.status === "completed";

                return (
                  <div
                    key={task.id}
                    draggable={!statusLocked}
                    onDragStart={() => {
                      if (!statusLocked) {
                        setBoardNotice(null);
                        setDraggingId(task.id);
                      }
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDropTarget(null);
                    }}
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
                    {task.project?.name ? (
                      <p className="text-xs text-muted-foreground">
                        {task.project.name}
                      </p>
                    ) : null}
                    <Link
                      href={`/tasks/${task.id}`}
                      className="mt-0.5 block font-medium underline-offset-4 hover:underline"
                      onClick={(event) => {
                        if (draggingId) event.preventDefault();
                      }}
                    >
                      {task.title}
                    </Link>

                    <p
                      className={cn(
                        "mt-1.5 flex items-center gap-1.5 text-xs",
                        (late || dueToday) && "font-medium text-destructive",
                        !late && !dueToday && "text-muted-foreground",
                      )}
                    >
                      <Calendar className="size-3.5 shrink-0" aria-hidden />
                      <span>
                        {task.dueDate ? formatCardDate(task.dueDate) : "—"}
                      </span>
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <PriorityPill
                        priority={task.priority}
                        label={priorityLabel(task.priority)}
                      />
                      {isCompleted ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 font-normal text-emerald-700 dark:text-emerald-300"
                        >
                          {t("status_completed")}
                        </Badge>
                      ) : null}
                      {late && task.dueDate ? (
                        <span className="text-xs font-medium text-destructive">
                          {t("boardLateWithDate", {
                            date: formatCardDate(task.dueDate),
                          })}
                        </span>
                      ) : null}
                      {dueToday ? (
                        <span className="text-xs font-medium text-destructive">
                          {tDashboard("dueTodayLabel")}
                        </span>
                      ) : null}
                    </div>

                    <TaskBlockerChips
                      blockers={task.incompleteDependencies ?? []}
                      allowOpenTask={false}
                    />

                    {!isCompleted ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-3 w-full"
                        onClick={(event) => {
                          event.stopPropagation();
                          setRequestTask({
                            id: task.id,
                            title: task.title,
                            dueDate: task.dueDate,
                          });
                        }}
                      >
                        {t("boardRequestExtensionOrExcusal")}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          );
        })}
      </div>

      <TaskRequestDialog
        open={requestTask != null}
        onOpenChange={(open) => {
          if (!open) setRequestTask(null);
        }}
        task={requestTask}
      />
    </div>
  );
}
