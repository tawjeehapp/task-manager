"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { DashboardTaskItem } from "@/features/dashboard/types/dashboard.types";
import type { TaskStatus } from "@/features/tasks/types/task.types";
import { isOverdueTask } from "@/features/dashboard/services/leadership-aggregates";
import { calendarDateOnly } from "@/features/dashboard/lib/actionable-tasks";
import { TaskRequestDialog } from "@/features/dashboard/components/task-request-dialog";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "completed",
];

const selectClassName =
  "border-input bg-background h-8 w-full min-w-[7.5rem] max-w-[10rem] rounded-md border px-2 text-sm";

async function patchTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const payload = (await response.json()) as {
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
}

type DashboardDayTaskTableProps = {
  tasks: DashboardTaskItem[];
  today: string;
};

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

export function DashboardDayTaskTable({
  tasks,
  today,
}: DashboardDayTaskTableProps) {
  const t = useTranslations("dashboard");
  const tTasks = useTranslations("tasks");
  const queryClient = useQueryClient();
  const [requestTask, setRequestTask] = useState<DashboardTaskItem | null>(
    null,
  );
  const [statusError, setStatusError] = useState<string | null>(null);

  const statusMutation = useMutation({
    mutationFn: ({
      taskId,
      status,
    }: {
      taskId: string;
      status: TaskStatus;
    }) => patchTaskStatus(taskId, status),
    onSuccess: async () => {
      setStatusError(null);
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => setStatusError(err.message),
  });

  function statusLabel(status: string) {
    return t(`status_${status}` as
      | "status_todo"
      | "status_in_progress"
      | "status_blocked"
      | "status_completed");
  }

  function priorityLabel(priority: string) {
    return tTasks(`priority_${priority}` as "priority_low");
  }

  function dueLabel(task: DashboardTaskItem) {
    const dueDate = calendarDateOnly(task.dueDate);
    if (!dueDate) return "—";
    if (isOverdueTask({ ...task, dueDate }, today)) {
      return t("dueLateLabel", { date: formatDate(dueDate) });
    }
    if (dueDate === today) {
      return t("dueTodayLabel");
    }
    return formatDate(dueDate);
  }

  return (
    <>
      {statusError ? (
        <p className="text-destructive mb-2 text-sm">{statusError}</p>
      ) : null}
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
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead className="w-[5.5rem]">{t("colRequest")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const dueDate = calendarDateOnly(task.dueDate);
              const late =
                dueDate != null && isOverdueTask({ ...task, dueDate }, today);
              const statusLocked =
                (task.incompleteDependencyCount ?? 0) > 0;
              return (
                <TableRow key={task.id}>
                  <TableCell>
                    <Link
                      href={task.href}
                      className="inline-flex min-w-0 flex-wrap items-center gap-1.5 font-medium underline-offset-4 hover:underline"
                    >
                      <span className="truncate">{task.title}</span>
                    </Link>
                    {statusLocked ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {tTasks("statusLockedByDependencies")}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {task.projectName ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <PriorityBadge
                      priority={task.priority}
                      label={priorityLabel(task.priority)}
                    />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "whitespace-nowrap text-sm",
                      (late || dueDate === today) &&
                        "font-medium text-destructive",
                    )}
                  >
                    {dueLabel(task)}
                  </TableCell>
                  <TableCell>
                    <select
                      className={selectClassName}
                      value={task.status}
                      disabled={
                        statusMutation.isPending || statusLocked
                      }
                      title={
                        statusLocked
                          ? tTasks("statusLockedByDependencies")
                          : undefined
                      }
                      aria-label={t("colStatus")}
                      onChange={(event) =>
                        statusMutation.mutate({
                          taskId: task.id,
                          status: event.target.value as TaskStatus,
                        })
                      }
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setRequestTask(task)}
                    >
                      {t("requestButton")}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <TaskRequestDialog
        open={requestTask != null}
        onOpenChange={(open) => {
          if (!open) setRequestTask(null);
        }}
        task={requestTask}
      />
    </>
  );
}
