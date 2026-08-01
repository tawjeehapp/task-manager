"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { DashboardAttendanceItem } from "@/features/dashboard/types/dashboard.types";
import type { DashboardTaskItem } from "@/features/dashboard/types/dashboard.types";
import type { Task } from "@/features/tasks/types/task.types";
import type { TasksListResult } from "@/features/tasks/services/tasks";
import type { TaskStatus } from "@/features/tasks/types/task.types";
import {
  AssigneeSelect,
  type AssigneeOption,
} from "@/features/tasks/components/assignee-select";
import { isOverdueTask } from "@/features/dashboard/services/leadership-aggregates";
import { orgLocalTimeOfDay } from "@/features/attendance/services/compute-hours";
import { addCalendarDays } from "@/lib/org-calendar";
import { formatDate } from "@/lib/dates";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function toDashboardItem(task: Task): DashboardTaskItem {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    dueDate: task.dueDate,
    priority: task.priority,
    projectName: task.project?.name ?? null,
    href: `/tasks/${task.id}`,
  };
}

async function fetchTasksByStatus(
  viewerId: string,
  status: TaskStatus,
): Promise<DashboardTaskItem[]> {
  const params = new URLSearchParams({
    page: "1",
    pageSize: "100",
    sortBy: "dueDate",
    sortDir: "asc",
    assignee: viewerId,
    status,
  });
  const response = await fetch(`/api/tasks?${params.toString()}`);
  const payload = (await response.json()) as {
    data?: TasksListResult;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return (payload.data?.items ?? []).map(toDashboardItem);
}

function timeRangeLabel(clockIn: string, clockOut: string | null): string {
  try {
    const start = orgLocalTimeOfDay(clockIn);
    if (!clockOut) return start;
    return `${start}-${orgLocalTimeOfDay(clockOut)}`;
  } catch {
    return "—";
  }
}

type EmployeeStatusTasksDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewerId: string;
  status: TaskStatus;
  today: string;
};

export function EmployeeStatusTasksDialog({
  open,
  onOpenChange,
  viewerId,
  status,
  today,
}: EmployeeStatusTasksDialogProps) {
  const t = useTranslations("dashboard");
  const tTasks = useTranslations("tasks");
  const tCommon = useTranslations("common");

  const tasksQuery = useQuery({
    queryKey: ["tasks", "metric", viewerId, status],
    queryFn: () => fetchTasksByStatus(viewerId, status),
    enabled: open,
  });

  function priorityLabel(priority: string) {
    return tTasks(`priority_${priority}` as "priority_low");
  }

  function dueLabel(task: DashboardTaskItem) {
    if (!task.dueDate) return "—";
    if (isOverdueTask(task, today)) {
      return t("dueLateLabel", { date: formatDate(task.dueDate) });
    }
    if (task.dueDate === today) {
      return t("dueTodayLabel");
    }
    return formatDate(task.dueDate);
  }

  const statusTitleKey = `status_${status}` as
    | "status_todo"
    | "status_in_progress"
    | "status_blocked"
    | "status_completed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("metricTasksModalTitle", { status: t(statusTitleKey) })}</DialogTitle>
        </DialogHeader>

        {tasksQuery.isLoading ? <LoadingState /> : null}
        {tasksQuery.isError ? (
          <ErrorState
            title={tCommon("errorTitle")}
            description={(tasksQuery.error as Error).message}
            onRetry={() => void tasksQuery.refetch()}
          />
        ) : null}

        {!tasksQuery.isLoading && !tasksQuery.isError ? (
          (tasksQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{t("metricTasksEmpty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colTask")}</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      {t("colProject")}
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      {t("colPriority")}
                    </TableHead>
                    <TableHead>{t("colDue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(tasksQuery.data ?? []).map((task) => {
                    const late = isOverdueTask(task, today);
                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          <Link
                            href={task.href}
                            className="inline-flex min-w-0 flex-wrap items-center gap-1.5 font-medium underline-offset-4 hover:underline"
                          >
                            <span className="truncate">{task.title}</span>
                          </Link>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {task.projectName ?? "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {priorityLabel(task.priority)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "whitespace-nowrap text-sm",
                            late && "font-medium text-destructive",
                          )}
                        >
                          {dueLabel(task)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type EmployeeWeekHoursDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekAttendance: DashboardAttendanceItem[];
  weekHours: number;
};

export function EmployeeWeekHoursDialog({
  open,
  onOpenChange,
  weekAttendance,
  weekHours,
}: EmployeeWeekHoursDialogProps) {
  const t = useTranslations("dashboard");
  const tAtt = useTranslations("attendance");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("metricHoursModalTitle")}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {t("weekHoursLabel", { hours: weekHours })}
        </p>

        {weekAttendance.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("weekLogEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {weekAttendance.map((row) => (
              <li key={row.id} className="space-y-2 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {formatDate(row.date, "dddd D MMMM")}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {timeRangeLabel(row.clockIn, row.clockOut)}
                    </span>
                  </div>
                  <span className="tabular-nums font-medium">
                    {row.totalHours != null
                      ? t("hoursValue", { hours: row.totalHours })
                      : "—"}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {tAtt(`uiState_${row.uiState}`)}
                </p>
                {row.allocations.length > 0 ? (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {row.allocations.map((allocation, index) => (
                      <li
                        key={`${row.id}-${allocation.kind}-${allocation.taskId ?? index}`}
                      >
                        {allocation.kind === "general"
                          ? `${tAtt("entryTypeGeneral")}: ${allocation.reason ?? "—"}`
                          : allocation.title}{" "}
                        · {t("hoursShort", { hours: allocation.hours })}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export type MetricTasksQuery = {
  assignee?: string;
  projectId?: string;
  departmentId?: string;
  status?: TaskStatus;
  dueFrom?: string;
  dueTo?: string;
  /** Extra client-side filter after the API response. */
  predicate?: "overdue" | "dueToday" | "incomplete";
};

type MetricTaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectName: string | null;
  projectId: string;
  departmentId: string | null;
  departmentName: string | null;
  href: string;
  assignedTo: string | null;
  assigneeName: string | null;
  estimatedHours: number;
  hoursWorked: number;
};

async function fetchHoursWorkedByTask(
  taskIds: string[],
  userId?: string,
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (taskIds.length === 0) return totals;

  if (userId) {
    const params = new URLSearchParams({
      page: "1",
      pageSize: "100",
      userId,
      sortBy: "date",
      sortDir: "desc",
    });
    const response = await fetch(`/api/work-logs?${params.toString()}`);
    const payload = (await response.json()) as {
      data?: { items: Array<{ taskId: string | null; hours: number }> };
      error?: { message: string };
    };
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Failed");
    }
    const wanted = new Set(taskIds);
    for (const row of payload.data?.items ?? []) {
      if (!row.taskId || !wanted.has(row.taskId)) continue;
      totals.set(row.taskId, (totals.get(row.taskId) ?? 0) + Number(row.hours));
    }
    for (const [taskId, hours] of totals) {
      totals.set(taskId, Math.round(hours * 100) / 100);
    }
    return totals;
  }

  const results = await Promise.all(
    taskIds.map(async (taskId) => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
        taskId,
        sortBy: "date",
        sortDir: "desc",
      });
      const response = await fetch(`/api/work-logs?${params.toString()}`);
      const payload = (await response.json()) as {
        data?: { items: Array<{ hours: number }> };
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed");
      }
      const sum = (payload.data?.items ?? []).reduce(
        (acc, row) => acc + Number(row.hours),
        0,
      );
      return [taskId, Math.round(sum * 100) / 100] as const;
    }),
  );
  for (const [taskId, hours] of results) {
    totals.set(taskId, hours);
  }
  return totals;
}

async function fetchMetricTasks(
  query: MetricTasksQuery,
  today: string,
): Promise<MetricTaskRow[]> {
  const params = new URLSearchParams({
    page: "1",
    pageSize: "100",
    sortBy: "dueDate",
    sortDir: "asc",
  });
  if (query.assignee) params.set("assignee", query.assignee);
  if (query.projectId) params.set("projectId", query.projectId);
  if (query.departmentId) params.set("departmentId", query.departmentId);
  if (query.status) params.set("status", query.status);
  if (query.dueFrom) params.set("dueFrom", query.dueFrom);
  if (query.dueTo) params.set("dueTo", query.dueTo);

  const response = await fetch(`/api/tasks?${params.toString()}`);
  const payload = (await response.json()) as {
    data?: TasksListResult;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }

  let tasks = payload.data?.items ?? [];
  if (query.predicate === "overdue") {
    tasks = tasks.filter((task) => isOverdueTask(task, today));
  } else if (query.predicate === "dueToday") {
    tasks = tasks.filter(
      (task) => task.status !== "completed" && task.dueDate === today,
    );
  } else if (query.predicate === "incomplete") {
    tasks = tasks.filter((task) => task.status !== "completed");
  }

  const hoursByTask = await fetchHoursWorkedByTask(
    tasks.map((task) => task.id),
    query.assignee,
  );

  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    projectName: task.project?.name ?? null,
    projectId: task.projectId,
    departmentId: task.project?.departmentId ?? null,
    departmentName: task.project?.departmentName ?? null,
    href: `/tasks/${task.id}`,
    assignedTo: task.assignedTo,
    assigneeName: task.assignee?.fullName ?? null,
    estimatedHours: task.estimatedHours,
    hoursWorked: hoursByTask.get(task.id) ?? 0,
  }));
}

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

const PRIORITIES = ["low", "medium", "high"] as const;
const metricSelectClassName =
  "border-input bg-background h-8 max-w-[9.5rem] rounded-md border px-2 text-sm";

function MetricTaskEditableRow({
  task,
  today,
}: {
  task: MetricTaskRow;
  today: string;
}) {
  const t = useTranslations("dashboard");
  const tTasks = useTranslations("tasks");
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ["task-assignees", task.projectId, task.departmentId],
    queryFn: () => fetchAssigneeOptions(task.projectId, task.departmentId),
    staleTime: 60_000,
  });

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => patchTask(task.id, body),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ["tasks", "leadership-metric"],
      });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => {
      setError(err.message || tTasks("inlineSaveFailed"));
    },
  });

  function priorityLabel(priority: string) {
    return tTasks(`priority_${priority}` as "priority_low");
  }

  function dueLabel() {
    if (!task.dueDate) return "—";
    if (isOverdueTask(task, today)) {
      return t("dueLateLabel", { date: formatDate(task.dueDate) });
    }
    if (task.dueDate === today) {
      return t("dueTodayLabel");
    }
    return formatDate(task.dueDate);
  }

  const assigneeOptions = useMemo(() => {
    const options = [...(membersQuery.data ?? [])];
    if (
      task.assignedTo &&
      !options.some((member) => member.id === task.assignedTo)
    ) {
      options.push({
        id: task.assignedTo,
        fullName: task.assigneeName ?? task.assignedTo,
      });
    }
    return options;
  }, [membersQuery.data, task.assignedTo, task.assigneeName]);

  const late = isOverdueTask(task, today);

  return (
    <TableRow>
      <TableCell>
        <Link
          href={task.href}
          className="inline-flex min-w-0 flex-wrap items-center gap-1.5 font-medium underline-offset-4 hover:underline"
        >
          <span className="truncate">{task.title}</span>
        </Link>
        {error ? (
          <p className="mt-1 text-xs text-destructive">{error}</p>
        ) : null}
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        {task.projectName ?? "—"}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {task.departmentName ?? "—"}
      </TableCell>
      <TableCell>
        <AssigneeSelect
          className={metricSelectClassName}
          value={task.assignedTo}
          disabled={patchMutation.isPending || membersQuery.isLoading}
          options={assigneeOptions}
          onChange={(userId) => patchMutation.mutate({ assignedTo: userId })}
        />
      </TableCell>
      <TableCell>
        <select
          className={metricSelectClassName}
          value={task.priority}
          disabled={patchMutation.isPending}
          aria-label={t("colPriority")}
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
      </TableCell>
      <TableCell className="text-center tabular-nums">
        {task.estimatedHours}
      </TableCell>
      <TableCell className="text-center tabular-nums">
        {task.hoursWorked > 0 ? task.hoursWorked : "—"}
      </TableCell>
      <TableCell
        className={cn(
          "whitespace-nowrap text-sm",
          late && "font-medium text-destructive",
        )}
      >
        {dueLabel()}
      </TableCell>
    </TableRow>
  );
}

type MetricTasksDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  today: string;
  query: MetricTasksQuery | null;
};

export function MetricTasksDialog({
  open,
  onOpenChange,
  title,
  today,
  query,
}: MetricTasksDialogProps) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");

  const tasksQuery = useQuery({
    queryKey: ["tasks", "leadership-metric", query],
    queryFn: () => fetchMetricTasks(query!, today),
    enabled: open && query != null,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {tasksQuery.isLoading ? <LoadingState /> : null}
        {tasksQuery.isError ? (
          <ErrorState
            title={tCommon("errorTitle")}
            description={(tasksQuery.error as Error).message}
            onRetry={() => void tasksQuery.refetch()}
          />
        ) : null}

        {!tasksQuery.isLoading && !tasksQuery.isError ? (
          (tasksQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("metricTasksEmpty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colTask")}</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      {t("colProject")}
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      {t("colDepartment")}
                    </TableHead>
                    <TableHead>{t("colAssignee")}</TableHead>
                    <TableHead>{t("colPriority")}</TableHead>
                    <TableHead className="text-center">
                      {t("colEstimatedHours")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t("colHoursWorked")}
                    </TableHead>
                    <TableHead>{t("colDue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(tasksQuery.data ?? []).map((task) => (
                    <MetricTaskEditableRow
                      key={task.id}
                      task={task}
                      today={today}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type MemberWeekHoursDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  userId: string | null;
  weekStart: string;
  weekEnd: string;
  today: string;
  weekHours: number;
  canApproveAttendance?: boolean;
};

type WeekDayEntry =
  | { date: string; kind: "missing" }
  | { date: string; kind: "recorded"; record: DashboardAttendanceItem };

function daysThroughToday(
  weekStart: string,
  weekEnd: string,
  today: string,
): string[] {
  const end = today < weekEnd ? today : weekEnd;
  if (end < weekStart) return [];
  const days: string[] = [];
  let cursor = weekStart;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return days;
}

function attendanceStatusBadgeClass(status: string): string {
  if (status === "approved") {
    return "border-transparent bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
  }
  if (status === "rejected") {
    return "border-transparent bg-destructive/15 text-destructive";
  }
  return "border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-300";
}

async function fetchMemberWeekAttendance(
  userId: string,
  weekStart: string,
  dateTo: string,
): Promise<DashboardAttendanceItem[]> {
  const params = new URLSearchParams({
    page: "1",
    pageSize: "100",
    userId,
    dateFrom: weekStart,
    dateTo,
    sortBy: "date",
    sortDir: "asc",
    includeAllocations: "true",
  });
  const response = await fetch(`/api/attendance?${params.toString()}`);
  const payload = (await response.json()) as {
    data?: {
      items: Array<{
        id: string;
        date: string;
        clockIn: string;
        clockOut: string | null;
        totalHours: number | null;
        status: string;
        uiState: DashboardAttendanceItem["uiState"];
        rejectionReason: string | null;
        allocations?: DashboardAttendanceItem["allocations"];
      }>;
    };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return (payload.data?.items ?? []).map((row) => ({
    id: row.id,
    date: row.date,
    clockIn: row.clockIn,
    clockOut: row.clockOut,
    totalHours: row.totalHours,
    status: row.status,
    uiState: row.uiState,
    rejectionReason: row.rejectionReason,
    allocations: row.allocations ?? [],
  }));
}

export function MemberWeekHoursDialog({
  open,
  onOpenChange,
  title,
  userId,
  weekStart,
  weekEnd,
  today,
  weekHours,
  canApproveAttendance = false,
}: MemberWeekHoursDialogProps) {
  const t = useTranslations("dashboard");
  const tAtt = useTranslations("attendance");
  const tApprovals = useTranslations("approvals");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const throughDate = today < weekEnd ? today : weekEnd;
  const days = useMemo(
    () => daysThroughToday(weekStart, weekEnd, today),
    [weekStart, weekEnd, today],
  );

  const attendanceQuery = useQuery({
    queryKey: ["attendance", "member-week", userId, weekStart, throughDate],
    queryFn: () => fetchMemberWeekAttendance(userId!, weekStart, throughDate),
    enabled: open && !!userId,
  });

  const dayEntries = useMemo((): WeekDayEntry[] => {
    const byDate = new Map(
      (attendanceQuery.data ?? []).map((row) => [row.date, row]),
    );
    return days.map((date) => {
      const record = byDate.get(date);
      if (!record) return { date, kind: "missing" };
      return { date, kind: "recorded", record };
    });
  }, [attendanceQuery.data, days]);

  const summary = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let missing = 0;
    for (const entry of dayEntries) {
      if (entry.kind === "missing") {
        missing += 1;
        continue;
      }
      if (entry.record.status === "approved") approved += 1;
      else if (entry.record.status === "rejected") rejected += 1;
      else pending += 1;
    }
    return { approved, pending, rejected, missing };
  }, [dayEntries]);

  async function invalidateAfterDecision() {
    await queryClient.invalidateQueries({
      queryKey: ["attendance", "member-week", userId],
    });
    await queryClient.invalidateQueries({ queryKey: ["attendance"] });
    await queryClient.invalidateQueries({ queryKey: ["approvals-attendance"] });
  }

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/attendance/${id}/approve`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed");
      }
    },
    onSuccess: async () => {
      setActionError(null);
      await invalidateAfterDecision();
    },
    onError: (error: Error) => {
      setActionError(error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectId) return;
      const response = await fetch(`/api/attendance/${rejectId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed");
      }
    },
    onSuccess: async () => {
      setActionError(null);
      setRejectId(null);
      setRejectReason("");
      await invalidateAfterDecision();
    },
    onError: (error: Error) => {
      setActionError(error.message);
    },
  });

  function statusLabel(row: DashboardAttendanceItem) {
    if (row.uiState === "currently_working") {
      return tAtt("uiState_currently_working");
    }
    if (row.uiState === "awaiting_approval") {
      return tAtt("uiState_awaiting_approval");
    }
    if (row.status === "approved") return t("status_approved");
    if (row.status === "rejected") return t("status_rejected");
    return t("status_pending");
  }

  function canDecide(row: DashboardAttendanceItem) {
    return (
      canApproveAttendance && row.uiState === "awaiting_approval"
    );
  }

  const deciding =
    approveMutation.isPending || rejectMutation.isPending;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setActionError(null);
            setRejectId(null);
            setRejectReason("");
          }
          onOpenChange(next);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-1">
            <p className="text-sm font-medium tabular-nums">
              {t("weekHoursLabel", { hours: weekHours })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("weekHoursDaySummary", {
                approved: summary.approved,
                pending: summary.pending,
                rejected: summary.rejected,
                missing: summary.missing,
              })}
            </p>
          </div>

          {actionError ? (
            <Alert variant="destructive">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}

          {attendanceQuery.isLoading ? <LoadingState /> : null}
          {attendanceQuery.isError ? (
            <ErrorState
              title={tCommon("errorTitle")}
              description={(attendanceQuery.error as Error).message}
              onRetry={() => void attendanceQuery.refetch()}
            />
          ) : null}

          {!attendanceQuery.isLoading && !attendanceQuery.isError ? (
            dayEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("weekLogEmpty")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {dayEntries.map((entry) => {
                  if (entry.kind === "missing") {
                    return (
                      <li
                        key={entry.date}
                        className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                      >
                        <span className="font-medium">
                          {formatDate(entry.date, "dddd D MMMM")}
                        </span>
                        <Badge variant="outline" className="font-normal">
                          {t("weekDayNotSubmitted")}
                        </Badge>
                      </li>
                    );
                  }

                  const row = entry.record;
                  const showActions = canDecide(row);
                  return (
                    <li key={row.id} className="space-y-2 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {formatDate(row.date, "dddd D MMMM")}
                          </span>
                          <span className="text-muted-foreground tabular-nums">
                            {timeRangeLabel(row.clockIn, row.clockOut)}
                          </span>
                        </div>
                        <span className="tabular-nums font-medium">
                          {row.totalHours != null
                            ? t("hoursValue", { hours: row.totalHours })
                            : "—"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-normal",
                            attendanceStatusBadgeClass(row.status),
                          )}
                        >
                          {statusLabel(row)}
                        </Badge>
                      </div>
                      {row.status === "rejected" && row.rejectionReason ? (
                        <p className="text-xs text-destructive">
                          {row.rejectionReason}
                        </p>
                      ) : null}
                      {row.allocations.length > 0 ? (
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {row.allocations.map((allocation, index) => (
                            <li
                              key={`${row.id}-${allocation.kind}-${allocation.taskId ?? index}`}
                            >
                              {allocation.kind === "general"
                                ? `${tAtt("entryTypeGeneral")}: ${allocation.reason ?? "—"}`
                                : allocation.title}{" "}
                              · {t("hoursShort", { hours: allocation.hours })}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {showActions ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={deciding}
                            onClick={() => {
                              setActionError(null);
                              setRejectId(row.id);
                              setRejectReason("");
                            }}
                          >
                            {tAtt("reject")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={deciding}
                            onClick={() => {
                              setActionError(null);
                              approveMutation.mutate(row.id);
                            }}
                          >
                            {tAtt("approve")}
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rejectId}
        onOpenChange={(next) => {
          if (!next) {
            setRejectId(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tApprovals("rejectTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="week-hours-reject-reason">
              {tApprovals("rejectionReasonLabel")}
            </Label>
            <textarea
              id="week-hours-reject-reason"
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring/50 flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectId(null);
                setRejectReason("");
              }}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                rejectReason.trim().length < 2 || rejectMutation.isPending
              }
              onClick={() => rejectMutation.mutate()}
            >
              {tApprovals("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
