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

function toDashboardItem(task: Task): DashboardTaskItem {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    dueDate: calendarDateOnly(task.dueDate),
    priority: task.priority,
    parentTaskId: task.parentTaskId,
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

  const dayTasks = useMemo(() => {
    if (mode !== "day") return [];
    if (range.isTodayActionable) {
      return tasksQuery.data ?? [];
    }
    return tasksByDate.get(focusDate) ?? [];
  }, [mode, range.isTodayActionable, tasksQuery.data, tasksByDate, focusDate]);

  function focusLabel() {
    if (mode === "day") return formatDate(focusDate);
    if (mode === "week") {
      const days = weekDays(focusDate);
      return `${formatDate(days[0]!)} – ${formatDate(days[6]!)}`;
    }
    return formatDate(focusDate, "YYYY/MM");
  }

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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
            {weekDays(focusDate).map((date) => {
              const items = tasksByDate.get(date) ?? [];
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => {
                    setFocusDate(date);
                    setMode("day");
                  }}
                  className={cn(
                    "min-h-[88px] rounded-md border p-2 text-start",
                    date === today && "border-primary",
                    isOrgWeekend(date) && "bg-muted/40",
                  )}
                >
                  <p className="mb-1 text-xs font-medium tabular-nums">
                    {formatDate(date, "DD")}
                  </p>
                  <ul className="space-y-1">
                    {items.slice(0, 3).map((task) => (
                      <li
                        key={task.id}
                        className="truncate text-[11px] text-muted-foreground"
                      >
                        {task.title}
                      </li>
                    ))}
                    {items.length > 3 ? (
                      <li className="text-[11px] text-muted-foreground">
                        +{items.length - 3}
                      </li>
                    ) : null}
                  </ul>
                </button>
              );
            })}
          </div>
        ) : null}

        {!tasksQuery.isLoading && !tasksQuery.isError && mode === "month" ? (
          <div className="grid grid-cols-7 gap-1">
            {monthGridDays(focusDate).map((date) => {
              const inMonth = date.slice(0, 7) === focusDate.slice(0, 7);
              const count = tasksByDate.get(date)?.length ?? 0;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => {
                    setFocusDate(date);
                    setMode("day");
                  }}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center rounded-md border text-xs",
                    !inMonth && "opacity-40",
                    date === today && "border-primary",
                    isOrgWeekend(date) && inMonth && "bg-muted/40",
                  )}
                >
                  <span className="tabular-nums">{formatDate(date, "D")}</span>
                  {count > 0 ? (
                    <span className="mt-0.5 size-1.5 rounded-full bg-primary" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
