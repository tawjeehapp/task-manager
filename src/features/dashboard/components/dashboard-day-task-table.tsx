"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { DashboardTaskItem } from "@/features/dashboard/types/dashboard.types";
import { isOverdueTask } from "@/features/dashboard/services/leadership-aggregates";
import { calendarDateOnly } from "@/features/dashboard/lib/actionable-tasks";
import { DashboardTaskStatusSelect } from "@/features/dashboard/components/dashboard-task-status-select";
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
  const [requestTask, setRequestTask] = useState<DashboardTaskItem | null>(
    null,
  );
  const [statusError, setStatusError] = useState<string | null>(null);

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
                    <DashboardTaskStatusSelect
                      task={task}
                      onError={setStatusError}
                    />
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
