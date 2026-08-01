"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  calendarDateOnly,
  isIncludedInTodayList,
  sortTodayListTasks,
} from "@/features/dashboard/lib/actionable-tasks";
import { DashboardDayTaskTable } from "@/features/dashboard/components/dashboard-day-task-table";
import type { DashboardTaskItem } from "@/features/dashboard/types/dashboard.types";
import type { AttendanceRecord } from "@/features/attendance/types/attendance.types";
import type { AttendanceUiState } from "@/features/attendance/types/attendance.types";
import type { Task } from "@/features/tasks/types/task.types";
import type { TasksListResult } from "@/features/tasks/services/tasks";
import {
  calendarRangeFor,
  monthGridDays,
  shiftFocusDate,
  weekDays,
  type CalendarRange,
  type CalendarViewMode,
} from "@/features/dashboard/lib/calendar-range";
import { isOrgWeekend } from "@/lib/org-calendar";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { cn } from "@/lib/utils";

type EmployeeTaskCalendarProps = {
  viewerId: string;
  today: string;
  initialTodayTasks: DashboardTaskItem[];
};

const TASK_CHIP_CLASS: Record<string, string> = {
  todo: "bg-muted text-muted-foreground hover:bg-muted/80",
  in_progress:
    "bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:text-amber-300",
  blocked:
    "bg-destructive/10 text-destructive hover:bg-destructive/15",
  completed:
    "bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/25 dark:text-emerald-300",
};

const ATTENDANCE_DOT_CLASS: Record<AttendanceUiState, string> = {
  approved: "bg-teal-500",
  awaiting_approval: "bg-amber-500",
  rejected: "bg-destructive",
  currently_working: "bg-sky-500",
};

const ATTENDANCE_DAY_CLASS: Record<AttendanceUiState, string> = {
  approved: "border-teal-500/30 bg-teal-500/10",
  awaiting_approval: "border-amber-500/30 bg-amber-500/10",
  rejected: "border-destructive/30 bg-destructive/10",
  currently_working: "border-sky-500/30 bg-sky-500/10",
};

function dayCellClassName(opts: {
  date: string;
  today: string;
  attendance?: AttendanceUiState;
  inMonth?: boolean;
}): string {
  const { date, today, attendance, inMonth = true } = opts;
  return cn(
    "flex flex-col rounded-lg border bg-background",
    attendance
      ? ATTENDANCE_DAY_CLASS[attendance]
      : isOrgWeekend(date) && inMonth
        ? "bg-muted/30"
        : null,
    date === today && "border-primary ring-1 ring-primary/30",
    !inMonth && "opacity-40",
  );
}

function toDashboardItem(task: Task): DashboardTaskItem {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    dueDate: calendarDateOnly(task.dueDate),
    priority: task.priority,
    projectName: task.project?.name ?? null,
    href: `/tasks/${task.id}`,
    incompleteDependencyCount: task.incompleteDependencyCount ?? 0,
  };
}

async function fetchTasksInRange(
  viewerId: string,
  range: CalendarRange,
  today: string,
): Promise<DashboardTaskItem[]> {
  const params = new URLSearchParams({
    page: "1",
    pageSize: "100",
    sortBy: "dueDate",
    sortDir: "asc",
    assignee: viewerId,
    dueTo: range.dueTo,
  });

  if (range.dueFrom) {
    params.set("dueFrom", range.dueFrom);
  }

  const response = await fetch(`/api/tasks?${params.toString()}`);
  const payload = (await response.json()) as {
    data?: TasksListResult;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }

  let items = (payload.data?.items ?? []).map(toDashboardItem);

  if (range.isTodayActionable) {
    items = sortTodayListTasks(
      items.filter((task) => isIncludedInTodayList(task, today)),
      today,
    );
  }

  return items;
}

async function fetchAttendanceInRange(
  viewerId: string,
  dateFrom: string,
  dateTo: string,
): Promise<AttendanceRecord[]> {
  const params = new URLSearchParams({
    page: "1",
    pageSize: "100",
    sortBy: "date",
    sortDir: "asc",
    userId: viewerId,
    dateFrom,
    dateTo,
  });
  const response = await fetch(`/api/attendance?${params.toString()}`);
  const payload = (await response.json()) as {
    data?: { items: AttendanceRecord[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data?.items ?? [];
}

function AttendanceDot({
  uiState,
  className,
}: {
  uiState: AttendanceUiState | undefined;
  className?: string;
}) {
  if (!uiState) return null;
  return (
    <span
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        ATTENDANCE_DOT_CLASS[uiState],
        className,
      )}
      aria-hidden
    />
  );
}

function TaskChip({
  task,
  compact,
}: {
  task: DashboardTaskItem;
  compact?: boolean;
}) {
  return (
    <Link
      href={task.href}
      title={task.title}
      className={cn(
        "block truncate rounded-md px-1.5 font-medium underline-offset-2 transition-colors hover:underline",
        compact ? "py-0.5 text-[10px] leading-tight" : "py-1 text-[11px] leading-snug",
        TASK_CHIP_CLASS[task.status] ?? TASK_CHIP_CLASS.todo,
      )}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      {task.title}
    </Link>
  );
}

function AttendanceLegend() {
  const tAtt = useTranslations("attendance");
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {(
        [
          "approved",
          "awaiting_approval",
          "rejected",
          "currently_working",
        ] as const
      ).map((state) => (
        <span key={state} className="inline-flex items-center gap-1.5">
          <AttendanceDot uiState={state} className="size-2" />
          {tAtt(`uiState_${state}`)}
        </span>
      ))}
    </div>
  );
}

export function EmployeeTaskCalendar({
  viewerId,
  today,
  initialTodayTasks,
}: EmployeeTaskCalendarProps) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const [mode, setMode] = useState<CalendarViewMode>("day");
  const [focusDate, setFocusDate] = useState(today);

  const range = useMemo(
    () => calendarRangeFor(mode, focusDate, today),
    [mode, focusDate, today],
  );

  const gridDays = useMemo(() => {
    if (mode === "week") return weekDays(focusDate);
    if (mode === "month") return monthGridDays(focusDate);
    return [] as string[];
  }, [mode, focusDate]);

  const attendanceRange = useMemo(() => {
    if (mode === "day") return null;
    if (gridDays.length === 0) return null;
    return {
      dateFrom: gridDays[0]!,
      dateTo: gridDays[gridDays.length - 1]!,
    };
  }, [mode, gridDays]);

  const isInitialDay =
    mode === "day" && focusDate === today && range.isTodayActionable === true;

  const tasksQuery = useQuery({
    queryKey: [
      "tasks",
      "calendar",
      viewerId,
      range.dueFrom ?? "actionable",
      range.dueTo,
      range.isTodayActionable ?? false,
    ],
    queryFn: () => fetchTasksInRange(viewerId, range, today),
    initialData: isInitialDay ? initialTodayTasks : undefined,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const attendanceQuery = useQuery({
    queryKey: [
      "attendance",
      "calendar",
      viewerId,
      attendanceRange?.dateFrom,
      attendanceRange?.dateTo,
    ],
    queryFn: () =>
      fetchAttendanceInRange(
        viewerId,
        attendanceRange!.dateFrom,
        attendanceRange!.dateTo,
      ),
    enabled: attendanceRange != null,
  });

  const tasksByDate = useMemo(() => {
    const map = new Map<string, DashboardTaskItem[]>();
    for (const task of tasksQuery.data ?? []) {
      const date = calendarDateOnly(task.dueDate);
      if (!date) continue;
      const list = map.get(date) ?? [];
      list.push(task);
      map.set(date, list);
    }
    return map;
  }, [tasksQuery.data]);

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, AttendanceUiState>();
    for (const row of attendanceQuery.data ?? []) {
      map.set(row.date, row.uiState);
    }
    return map;
  }, [attendanceQuery.data]);

  const dayTasks = useMemo(() => {
    if (mode !== "day") return [];
    if (range.isTodayActionable) {
      return tasksQuery.data ?? [];
    }
    return tasksByDate.get(focusDate) ?? [];
  }, [mode, range.isTodayActionable, tasksQuery.data, tasksByDate, focusDate]);

  const weekdayLabels = useMemo(() => {
    return weekDays(focusDate).map((date) => formatDate(date, "dd"));
  }, [focusDate]);

  function focusLabel() {
    if (mode === "day") return formatDate(focusDate);
    if (mode === "week") {
      const days = weekDays(focusDate);
      return `${formatDate(days[0]!)} – ${formatDate(days[6]!)}`;
    }
    return formatDate(focusDate, "MMMM YYYY");
  }

  function openDay(date: string) {
    setFocusDate(date);
    setMode("day");
  }

  const weekTaskLimit = 4;
  const monthTaskLimit = 3;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{t("todayTasksTitle")}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {(["day", "week", "month"] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={mode === value ? "default" : "outline"}
              onClick={() => setMode(value)}
            >
              {t(`calendarView_${value}`)}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button
            size="icon"
            variant="outline"
            aria-label={t("calendarPrev")}
            onClick={() => setFocusDate(shiftFocusDate(mode, focusDate, -1))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <p className="text-sm font-medium tabular-nums">{focusLabel()}</p>
          <Button
            size="icon"
            variant="outline"
            aria-label={t("calendarNext")}
            onClick={() => setFocusDate(shiftFocusDate(mode, focusDate, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>

        {tasksQuery.isLoading ? <LoadingState /> : null}
        {tasksQuery.isError ? (
          <ErrorState
            title={tCommon("errorTitle")}
            description={(tasksQuery.error as Error).message}
            onRetry={() => void tasksQuery.refetch()}
          />
        ) : null}

        {!tasksQuery.isLoading && !tasksQuery.isError && mode === "day" ? (
          dayTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("calendarDayEmpty")}{" "}
              <Link
                href="/tasks"
                className="text-primary underline-offset-4 hover:underline"
              >
                {t("openMyTasks")}
              </Link>
            </p>
          ) : (
            <DashboardDayTaskTable tasks={dayTasks} today={today} />
          )
        ) : null}

        {!tasksQuery.isLoading && !tasksQuery.isError && mode === "week" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
              {gridDays.map((date) => {
                const items = tasksByDate.get(date) ?? [];
                const attendance = attendanceByDate.get(date);
                return (
                  <div
                    key={date}
                    className={cn(
                      "min-h-[140px] p-2",
                      dayCellClassName({ date, today, attendance }),
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openDay(date)}
                      className="mb-1.5 flex w-full items-center justify-between gap-1 rounded-md px-0.5 text-start hover:bg-muted/60"
                      title={t("calendarOpenDay")}
                    >
                      <span className="text-xs font-semibold tabular-nums">
                        {formatDate(date, "dd D")}
                      </span>
                      <AttendanceDot uiState={attendance} />
                    </button>
                    <ul className="flex min-h-0 flex-1 flex-col gap-1">
                      {items.slice(0, weekTaskLimit).map((task) => (
                        <li key={task.id}>
                          <TaskChip task={task} />
                        </li>
                      ))}
                      {items.length > weekTaskLimit ? (
                        <li>
                          <button
                            type="button"
                            className="w-full rounded-md px-1.5 py-0.5 text-start text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            onClick={() => openDay(date)}
                          >
                            {t("calendarMoreTasks", {
                              count: items.length - weekTaskLimit,
                            })}
                          </button>
                        </li>
                      ) : null}
                      {items.length === 0 ? (
                        <li className="px-0.5 text-[11px] text-muted-foreground">
                          {t("calendarNoTasks")}
                        </li>
                      ) : null}
                    </ul>
                  </div>
                );
              })}
            </div>
            <AttendanceLegend />
          </div>
        ) : null}

        {!tasksQuery.isLoading && !tasksQuery.isError && mode === "month" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-7 gap-1">
              {weekdayLabels.map((label, index) => (
                <div
                  key={`${label}-${index}`}
                  className="px-1 pb-1 text-center text-[11px] font-medium text-muted-foreground"
                >
                  {label}
                </div>
              ))}
              {gridDays.map((date) => {
                const inMonth = date.slice(0, 7) === focusDate.slice(0, 7);
                const items = tasksByDate.get(date) ?? [];
                const attendance = attendanceByDate.get(date);
                return (
                  <div
                    key={date}
                    className={cn(
                      "min-h-[108px] gap-1 p-1.5",
                      dayCellClassName({
                        date,
                        today,
                        attendance,
                        inMonth,
                      }),
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openDay(date)}
                      className="flex w-full items-center justify-between gap-1 rounded px-0.5 text-start hover:bg-muted/60"
                      title={t("calendarOpenDay")}
                    >
                      <span className="text-xs font-semibold tabular-nums">
                        {formatDate(date, "D")}
                      </span>
                      <AttendanceDot uiState={attendance} />
                    </button>
                    <ul className="flex min-h-0 flex-1 flex-col gap-0.5">
                      {items.slice(0, monthTaskLimit).map((task) => (
                        <li key={task.id}>
                          <TaskChip task={task} compact />
                        </li>
                      ))}
                      {items.length > monthTaskLimit ? (
                        <li>
                          <button
                            type="button"
                            className="w-full rounded px-1 py-0.5 text-start text-[10px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            onClick={() => openDay(date)}
                          >
                            {t("calendarMoreTasks", {
                              count: items.length - monthTaskLimit,
                            })}
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                );
              })}
            </div>
            <AttendanceLegend />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
