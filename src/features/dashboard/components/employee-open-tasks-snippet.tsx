"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ListTodo } from "lucide-react";

import type { DashboardTaskItem } from "@/features/dashboard/types/dashboard.types";
import type { TaskStatus } from "@/features/tasks/types/task.types";
import { calendarDateOnly } from "@/features/dashboard/lib/actionable-tasks";
import { isOverdueTask } from "@/features/dashboard/services/leadership-aggregates";
import { DashboardTaskStatusSelect } from "@/features/dashboard/components/dashboard-task-status-select";
import { TaskRequestDialog } from "@/features/dashboard/components/task-request-dialog";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EmployeeOpenTasksSnippetProps = {
  tasks: DashboardTaskItem[];
  today: string;
  openCount: number;
};

const OPEN_STATUSES = new Set(["todo", "in_progress", "blocked"]);

function PriorityBadge({
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

export function EmployeeOpenTasksSnippet({
  tasks,
  today,
  openCount,
}: EmployeeOpenTasksSnippetProps) {
  const t = useTranslations("dashboard");
  const tTasks = useTranslations("tasks");
  const [items, setItems] = useState(tasks);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [requestTask, setRequestTask] = useState<DashboardTaskItem | null>(
    null,
  );

  useEffect(() => {
    setItems(tasks);
  }, [tasks]);

  function priorityLabel(priority: string) {
    return tTasks(`priority_${priority}` as "priority_low");
  }

  function dueLabel(task: DashboardTaskItem) {
    const dueDate = calendarDateOnly(task.dueDate);
    if (!dueDate) return t("noDueDate");
    if (isOverdueTask({ ...task, dueDate }, today)) {
      return t("dueLateLabel", { date: formatDate(dueDate) });
    }
    if (dueDate === today) {
      return t("dueTodayLabel");
    }
    return formatDate(dueDate);
  }

  function applyStatus(taskId: string, status: TaskStatus | string) {
    setItems((current) =>
      current
        .map((task) => (task.id === taskId ? { ...task, status } : task))
        .filter((task) => OPEN_STATUSES.has(task.status)),
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex min-w-0 items-center gap-2">
          <ListTodo className="size-4 shrink-0 text-muted-foreground" />
          <CardTitle>{t("openTasksTitle")}</CardTitle>
        </div>
        <Link
          href="/tasks"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
        >
          {t("openMyTasks")}
        </Link>
      </CardHeader>
      <CardContent>
        {statusError ? (
          <p className="text-destructive mb-2 text-sm">{statusError}</p>
        ) : null}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("openTasksEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((task) => {
              const dueDate = calendarDateOnly(task.dueDate);
              const late =
                dueDate != null && isOverdueTask({ ...task, dueDate }, today);
              const statusLocked =
                (task.incompleteDependencyCount ?? 0) > 0;
              return (
                <li key={task.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={task.href}
                    className="block min-w-0 font-medium underline-offset-4 hover:underline"
                  >
                    <span className="line-clamp-2">{task.title}</span>
                  </Link>
                  {task.projectName ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {task.projectName}
                    </p>
                  ) : null}
                  {statusLocked ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {tTasks("statusLockedByDependencies")}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <PriorityBadge
                      priority={task.priority}
                      label={priorityLabel(task.priority)}
                    />
                    <span
                      className={cn(
                        "text-xs tabular-nums text-muted-foreground",
                        (late || dueDate === today) &&
                          "font-medium text-destructive",
                      )}
                    >
                      {dueLabel(task)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-start gap-1.5">
                    <DashboardTaskStatusSelect
                      task={task}
                      className="h-7 w-auto min-w-0 max-w-[7.5rem] px-1.5 text-xs"
                      onOptimisticChange={(taskId, status) => {
                        setStatusError(null);
                        applyStatus(taskId, status);
                      }}
                      onOptimisticRollback={applyStatus}
                      onError={setStatusError}
                    />
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => setRequestTask(task)}
                    >
                      {t("requestButton")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {openCount > tasks.length ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("openTasksMore", {
              shown: tasks.length,
              total: openCount,
            })}{" "}
            <Link
              href="/tasks"
              className="text-primary underline-offset-4 hover:underline"
            >
              {t("openMyTasks")}
            </Link>
          </p>
        ) : null}
      </CardContent>

      <TaskRequestDialog
        open={requestTask != null}
        onOpenChange={(open) => {
          if (!open) setRequestTask(null);
        }}
        task={requestTask}
      />
    </Card>
  );
}
