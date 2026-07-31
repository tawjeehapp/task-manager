"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { DashboardAttendanceItem } from "@/features/dashboard/types/dashboard.types";
import type { DashboardTaskItem } from "@/features/dashboard/types/dashboard.types";
import type { Task } from "@/features/tasks/types/task.types";
import type { TasksListResult } from "@/features/tasks/services/tasks";
import type { TaskStatus } from "@/features/tasks/types/task.types";
import { isOverdueTask } from "@/features/dashboard/services/leadership-aggregates";
import { orgLocalTimeOfDay } from "@/features/attendance/services/compute-hours";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    parentTaskId: task.parentTaskId,
    parentTitle: task.parentTitle ?? null,
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
                            {task.parentTaskId ? (
                              <Badge
                                variant="secondary"
                                className="shrink-0 text-[10px]"
                              >
                                {t("subtaskBadge")}
                              </Badge>
                            ) : null}
                          </Link>
                          {task.parentTaskId ? (
                            <p className="text-muted-foreground mt-1 text-xs">
                              {tTasks("boardUnderParent", {
                                title: task.parentTitle ?? "—",
                              })}
                            </p>
                          ) : null}
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
