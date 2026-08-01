"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Calendar, Lock, Search, TriangleAlert } from "lucide-react";

import type {
  ProjectMember,
} from "@/features/projects/types/project.types";
import type { Task, TaskStatus } from "@/features/tasks/types/task.types";
import {
  selectableTaskStatuses,
  TASK_STATUSES,
} from "@/features/tasks/types/task.types";
import {
  formatTaskDateRange,
  isLateTask,
} from "@/features/tasks/components/employee-tasks-board";
import { TaskRequestDialog } from "@/features/dashboard/components/task-request-dialog";
import { TaskAttachmentDownloads } from "@/features/tasks/components/task-attachment-downloads";
import { TaskBlockerChips } from "@/features/tasks/components/task-blocker-summary";
import { todayInOrgTimezone } from "@/lib/org-calendar";
import { formatDate } from "@/lib/dates";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type EmployeeProjectTasksTableProps = {
  tasks: Task[];
  members: ProjectMember[];
  viewerId: string;
  isLoading?: boolean;
};

const selectClassName =
  "border-input bg-background h-9 rounded-md border px-3 text-sm";

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

function StatusBadge({
  status,
  label,
}: {
  status: TaskStatus;
  label: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-normal",
        status === "todo" &&
          "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300",
        status === "in_progress" &&
          "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300",
        status === "blocked" && "text-muted-foreground",
        status === "completed" &&
          "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      )}
    >
      {label}
    </Badge>
  );
}

function filterProjectTasks(
  tasks: Task[],
  opts: {
    search: string;
    status: string;
    priority: string;
    memberId: string;
    lateOnly: boolean;
    today: string;
  },
): Task[] {
  const q = opts.search.trim().toLowerCase();
  return tasks.filter((task) => {
    if (opts.status && task.status !== opts.status) return false;
    if (opts.priority && task.priority !== opts.priority) return false;
    if (opts.memberId && task.assignedTo !== opts.memberId) return false;
    if (opts.lateOnly && !isLateTask(task, opts.today)) return false;
    if (q && !task.title.toLowerCase().includes(q)) return false;
    return true;
  });
}

function WaitingBadge({ task }: { task: Task }) {
  const tProjects = useTranslations("projects");
  const tTasks = useTranslations("tasks");
  const blockers = task.incompleteDependencies ?? [];
  if (blockers.length > 0) {
    return <TaskBlockerChips blockers={blockers} allowOpenTask={false} />;
  }

  const incomplete = task.incompleteDependencyCount ?? 0;
  if (incomplete <= 0) return null;

  const firstTitle = task.incompleteDependencyTitles?.[0];
  const label = firstTitle
    ? tProjects("waitingForTask", { title: firstTitle })
    : tTasks("boardWaitingOnDependencies");

  return (
    <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/60 px-1.5 py-0.5 text-xs text-muted-foreground">
      <Lock className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

function PeerTaskSummaryDialog({
  task,
  open,
  onOpenChange,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("tasks");

  function statusLabel(status: TaskStatus) {
    return t(`status_${status}` as "status_todo");
  }

  function priorityLabel(priority: string) {
    return t(`priority_${priority}` as "priority_low");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task?.title ?? t("blockerSummaryTitle")}</DialogTitle>
        </DialogHeader>

        {task ? (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm">
              <div className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("status")}</dt>
                <dd>{statusLabel(task.status)}</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("assignee")}</dt>
                <dd>{task.assignee?.fullName ?? t("unassigned")}</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("priority")}</dt>
                <dd>
                  <PriorityPill
                    priority={task.priority}
                    label={priorityLabel(task.priority)}
                  />
                </dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("dueDate")}</dt>
                <dd className="inline-flex items-center gap-1.5">
                  <Calendar
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  {task.dueDate ? formatDate(task.dueDate, "D MMMM") : "—"}
                </dd>
              </div>
            </dl>

            <div className="grid gap-2">
              <p className="text-xs text-muted-foreground">{t("tabAttachments")}</p>
              <TaskAttachmentDownloads
                taskId={task.id}
                attachments={task.attachments ?? []}
                emptyLabel={t("attachmentsEmptyTitle")}
              />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EmployeeTaskRow({
  task,
  viewerId,
  onRequest,
  onOpenSummary,
}: {
  task: Task;
  viewerId: string;
  onRequest: (task: Pick<Task, "id" | "title" | "dueDate">) => void;
  onOpenSummary: (task: Task) => void;
}) {
  const t = useTranslations("tasks");
  const tDashboard = useTranslations("dashboard");
  const queryClient = useQueryClient();
  const today = todayInOrgTimezone();
  const canEditStatus = task.assignedTo === viewerId;
  const statusLocked = (task.incompleteDependencyCount ?? 0) > 0;
  const duration = formatTaskDateRange(task);
  const attachments = task.attachments ?? [];

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) => patchTaskStatus(task.id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  function statusLabel(status: TaskStatus) {
    return t(`status_${status}` as "status_todo");
  }

  function priorityLabel(priority: string) {
    return t(`priority_${priority}` as "priority_low");
  }

  return (
    <TableRow className={cn(isLateTask(task, today) && "bg-destructive/5")}>
      <TableCell>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            {canEditStatus ? (
              <Link
                href={`/tasks/${task.id}`}
                className="min-w-0 truncate font-medium underline-offset-4 hover:underline"
              >
                {task.title}
              </Link>
            ) : (
              <button
                type="button"
                className="min-w-0 truncate text-start font-medium underline-offset-4 hover:underline"
                onClick={() => onOpenSummary(task)}
              >
                {task.title}
              </button>
            )}
          </div>
          <WaitingBadge task={task} />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {task.assignee ? (
            <>
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
                aria-hidden
              >
                {task.assignee.fullName.trim().charAt(0) || "?"}
              </span>
              <span className="truncate text-sm">
                {task.assignee.fullName}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">{t("unassigned")}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
        {duration ?? "—"}
      </TableCell>
      <TableCell>
        <PriorityPill
          priority={task.priority}
          label={priorityLabel(task.priority)}
        />
      </TableCell>
      <TableCell className="min-w-[8rem]">
        {attachments.length > 0 ? (
          <TaskAttachmentDownloads
            taskId={task.id}
            attachments={attachments}
            variant="chips"
          />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          {canEditStatus && !statusLocked && task.status !== "completed" ? (
            <select
              className={selectClassName}
              value={task.status}
              disabled={statusMutation.isPending}
              aria-label={t("status")}
              onChange={(event) =>
                statusMutation.mutate(event.target.value as TaskStatus)
              }
            >
              {selectableTaskStatuses(task.status).map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          ) : (
            <StatusBadge
              status={task.status}
              label={statusLabel(task.status)}
            />
          )}
          {canEditStatus && task.status !== "completed" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                onRequest({
                  id: task.id,
                  title: task.title,
                  dueDate: task.dueDate,
                })
              }
            >
              {tDashboard("requestButton")}
            </Button>
          ) : null}
        </div>
        {statusMutation.isError ? (
          <p className="mt-1 text-xs text-destructive">
            {(statusMutation.error as Error).message}
          </p>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export function EmployeeProjectTasksTable({
  tasks,
  members,
  viewerId,
  isLoading,
}: EmployeeProjectTasksTableProps) {
  const t = useTranslations("tasks");
  const tProjects = useTranslations("projects");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [lateOnly, setLateOnly] = useState(false);
  const [requestTask, setRequestTask] = useState<Pick<
    Task,
    "id" | "title" | "dueDate"
  > | null>(null);
  const [summaryTask, setSummaryTask] = useState<Task | null>(null);
  const today = todayInOrgTimezone();

  const filtered = useMemo(
    () =>
      filterProjectTasks(tasks, {
        search,
        status: statusFilter,
        priority: priorityFilter,
        memberId: memberFilter,
        lateOnly,
        today,
      }),
    [tasks, search, statusFilter, priorityFilter, memberFilter, lateOnly, today],
  );

  function statusLabel(status: TaskStatus) {
    return t(`status_${status}` as "status_todo");
  }

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchTasks")}
            className="ps-8"
          />
        </div>
        <select
          className={selectClassName}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
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
          className={selectClassName}
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          aria-label={t("priority")}
        >
          <option value="">{t("filterAllPriorities")}</option>
          <option value="low">{t("priority_low")}</option>
          <option value="medium">{t("priority_medium")}</option>
          <option value="high">{t("priority_high")}</option>
        </select>
        <select
          className={selectClassName}
          value={memberFilter}
          onChange={(event) => setMemberFilter(event.target.value)}
          aria-label={t("assignee")}
        >
          <option value="">{tProjects("filterAllMembers")}</option>
          {members.map((member) =>
            member.user ? (
              <option key={member.userId} value={member.userId}>
                {member.user.fullName}
              </option>
            ) : null,
          )}
        </select>
        <label
          className={cn(
            "flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm",
            lateOnly && "border-destructive/40 bg-destructive/5",
          )}
        >
          <TriangleAlert
            className={cn(
              "size-4",
              lateOnly ? "text-destructive" : "text-muted-foreground",
            )}
            aria-hidden
          />
          <input
            type="checkbox"
            className="sr-only"
            checked={lateOnly}
            onChange={(event) => setLateOnly(event.target.checked)}
          />
          {t("lateOnly")}
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("titleLabel")}</TableHead>
                <TableHead>{t("assignee")}</TableHead>
                <TableHead>{tProjects("duration")}</TableHead>
                <TableHead>{t("priority")}</TableHead>
                <TableHead>{t("tabAttachments")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((task) => (
                <EmployeeTaskRow
                  key={task.id}
                  task={task}
                  viewerId={viewerId}
                  onRequest={setRequestTask}
                  onOpenSummary={setSummaryTask}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TaskRequestDialog
        open={requestTask != null}
        onOpenChange={(open) => {
          if (!open) setRequestTask(null);
        }}
        task={requestTask}
      />

      <PeerTaskSummaryDialog
        task={summaryTask}
        open={summaryTask != null}
        onOpenChange={(open) => {
          if (!open) setSummaryTask(null);
        }}
      />
    </div>
  );
}
