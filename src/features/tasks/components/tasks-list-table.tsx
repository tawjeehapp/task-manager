"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, ExternalLink, GitBranch, Pencil, Trash2 } from "lucide-react";

import type {
  Task,
  TaskPriority,
} from "@/features/tasks/types/task.types";
import { selectableTaskStatuses } from "@/features/tasks/types/task.types";
import { AssigneeSelect } from "@/features/tasks/components/assignee-select";
import type { AssigneeOption } from "@/features/tasks/components/assignee-select";
import { TaskDependenciesPanel } from "@/features/tasks/components/task-dependencies-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

type TasksListTableProps = {
  tasks: Task[];
  canEdit: boolean;
  viewerId: string;
  showProject?: boolean;
  className?: string;
};

const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

const selectClassName =
  "border-input bg-background h-8 max-w-[9.5rem] rounded-md border px-2 text-sm";

function DependencyCountCell({
  task,
  onOpen,
}: {
  task: Task;
  onOpen?: () => void;
}) {
  const t = useTranslations("tasks");
  const count = task.dependencyCount ?? 0;
  const incomplete = task.incompleteDependencyCount ?? 0;

  if (count === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const label =
    incomplete > 0
      ? t("dependencyColumnIncomplete", { incomplete, count })
      : t("dependencyColumnComplete", { count });

  const content = (
    <>
      <GitBranch className="text-muted-foreground size-3.5 shrink-0" />
      <span className="tabular-nums text-sm">{count}</span>
      {incomplete > 0 ? (
        <Badge variant="secondary" className="text-xs">
          {t("dependencyBlocking")}
        </Badge>
      ) : null}
    </>
  );

  if (!onOpen) {
    return (
      <span className="inline-flex items-center gap-1.5" title={label}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="hover:bg-muted inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-start transition-colors"
      title={label}
      aria-label={t("viewDependencies", { title: task.title })}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
    >
      {content}
    </button>
  );
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
          userId?: string;
          user?: { id: string; fullName: string; employeeNumber?: string };
        }>;
      };
    };
    if (!response.ok) {
      continue;
    }
    for (const member of payload.data?.items ?? []) {
      const user = member.user;
      if (!user) {
        continue;
      }
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

async function createTask(body: Record<string, unknown>): Promise<Task> {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    data?: Task;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

async function deleteTaskRequest(taskId: string): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
  const payload = (await response.json()) as {
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
}

function TaskInlineFields({
  task,
  canEditFull,
  canEditStatus,
  showProject,
}: {
  task: Task;
  canEditFull: boolean;
  canEditStatus: boolean;
  showProject: boolean;
}) {
  const t = useTranslations("tasks");
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [depsOpen, setDepsOpen] = useState(false);
  const canEditHours = canEditFull;

  const membersQuery = useQuery({
    queryKey: [
      "task-assignees",
      task.projectId,
      task.project?.departmentId,
    ],
    queryFn: () =>
      fetchAssigneeOptions(task.projectId, task.project?.departmentId),
    enabled: canEditFull,
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

  function statusLabel(status: string) {
    return t(`status_${status}` as "status_todo");
  }

  function priorityLabel(priority: string) {
    return t(`priority_${priority}` as "priority_low");
  }

  const hoursDisplay =
    task.estimatedHours != null ? String(task.estimatedHours) : "—";

  const statusLockedByDeps = (task.incompleteDependencyCount ?? 0) > 0;

  const titleCell = (
    <div
      className="flex min-w-0 items-center gap-1.5"
      onClick={(event) => event.stopPropagation()}
    >
      {canEditFull && editingTitle ? (
        <Input
          key={`${task.id}-${task.title}-edit`}
          className="h-8 min-w-[10rem] font-medium"
          defaultValue={task.title}
          autoFocus
          disabled={patchMutation.isPending}
          aria-label={t("titleLabel")}
          onBlur={(event) => {
            const next = event.target.value.trim();
            setEditingTitle(false);
            if (!next || next === task.title) {
              return;
            }
            patchMutation.mutate({ title: next });
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setEditingTitle(false);
            }
          }}
        />
      ) : (
        <>
          <Link
            href={`/tasks/${task.id}`}
            className="min-w-0 truncate font-medium underline-offset-4 hover:underline"
          >
            {task.title}
          </Link>
          {canEditFull ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t("editTitle")}
              onClick={() => setEditingTitle(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
          ) : null}
        </>
      )}
    </div>
  );

  if (!canEditFull && !canEditStatus) {
    return (
      <>
        <TableCell>{titleCell}</TableCell>
        {showProject ? (
          <TableCell>
            {task.project ? (
              <Link
                href={`/projects/${task.project.id}`}
                className="underline-offset-4 hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {task.project.name}
              </Link>
            ) : (
              "—"
            )}
          </TableCell>
        ) : null}
        <TableCell>{statusLabel(task.status)}</TableCell>
        <TableCell>{priorityLabel(task.priority)}</TableCell>
        <TableCell>{task.assignee?.fullName ?? "—"}</TableCell>
        <TableCell>
          <span>{hoursDisplay}</span>
        </TableCell>
        <TableCell>{task.dueDate ?? "—"}</TableCell>
        <TableCell onClick={(event) => event.stopPropagation()}>
          <DependencyCountCell
            task={task}
            onOpen={() => setDepsOpen(true)}
          />
        </TableCell>
        <Dialog open={depsOpen} onOpenChange={setDepsOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("tabDependencies")}</DialogTitle>
              <DialogDescription>{task.title}</DialogDescription>
            </DialogHeader>
            <TaskDependenciesPanel
              taskId={task.id}
              projectId={task.projectId}
              canManage={false}
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <TableCell>
        {titleCell}
        {error ? (
          <p className="text-destructive mt-1 text-xs">{error}</p>
        ) : null}
      </TableCell>
      {showProject ? (
        <TableCell>
          {task.project ? (
            <Link
              href={`/projects/${task.project.id}`}
              className="underline-offset-4 hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {task.project.name}
            </Link>
          ) : (
            "—"
          )}
        </TableCell>
      ) : null}
      <TableCell onClick={(event) => event.stopPropagation()}>
        <select
          className={selectClassName}
          value={task.status}
          disabled={
            patchMutation.isPending ||
            statusLockedByDeps ||
            (!canEditFull && !canEditStatus)
          }
          title={
            statusLockedByDeps ? t("statusLockedByDependencies") : undefined
          }
          onChange={(event) =>
            patchMutation.mutate({ status: event.target.value })
          }
          aria-label={t("status")}
        >
          {selectableTaskStatuses(task.status).map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
      </TableCell>
      <TableCell onClick={(event) => event.stopPropagation()}>
        {canEditFull ? (
          <select
            className={selectClassName}
            value={task.priority}
            disabled={patchMutation.isPending}
            onChange={(event) =>
              patchMutation.mutate({ priority: event.target.value })
            }
            aria-label={t("priority")}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabel(priority)}
              </option>
            ))}
          </select>
        ) : (
          priorityLabel(task.priority)
        )}
      </TableCell>
      <TableCell onClick={(event) => event.stopPropagation()}>
        {canEditFull ? (
          <AssigneeSelect
            className={selectClassName}
            value={task.assignedTo}
            disabled={patchMutation.isPending || membersQuery.isLoading}
            options={(() => {
              const options = [...(membersQuery.data ?? [])];
              if (
                task.assignedTo &&
                !options.some((m) => m.id === task.assignedTo)
              ) {
                options.push({
                  id: task.assignedTo,
                  fullName: task.assignee?.fullName ?? task.assignedTo,
                });
              }
              return options;
            })()}
            onChange={(userId) =>
              patchMutation.mutate({ assignedTo: userId })
            }
          />
        ) : (
          (task.assignee?.fullName ?? "—")
        )}
      </TableCell>
      <TableCell onClick={(event) => event.stopPropagation()}>
        {canEditHours ? (
          <Input
            type="number"
            step="0.5"
            min="0"
            className="h-8 w-20"
            defaultValue={task.estimatedHours ?? ""}
            disabled={patchMutation.isPending}
            aria-label={t("estimatedHours")}
            onBlur={(event) => {
              const raw = event.target.value;
              const next =
                raw === ""
                  ? null
                  : Number.isFinite(Number(raw))
                    ? Number(raw)
                    : null;
              if (next === task.estimatedHours) {
                return;
              }
              patchMutation.mutate({ estimatedHours: next });
            }}
          />
        ) : (
          <span>{hoursDisplay}</span>
        )}
      </TableCell>
      <TableCell onClick={(event) => event.stopPropagation()}>
        {canEditFull ? (
          <Input
            type="date"
            className="h-8 w-[9.5rem]"
            defaultValue={task.dueDate ?? ""}
            disabled={patchMutation.isPending}
            aria-label={t("dueDate")}
            onBlur={(event) => {
              const next = event.target.value || null;
              if (next === task.dueDate) {
                return;
              }
              patchMutation.mutate({ dueDate: next });
            }}
          />
        ) : (
          (task.dueDate ?? "—")
        )}
      </TableCell>
      <TableCell onClick={(event) => event.stopPropagation()}>
        <DependencyCountCell
          task={task}
          onOpen={() => setDepsOpen(true)}
        />
      </TableCell>
      <Dialog open={depsOpen} onOpenChange={setDepsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("tabDependencies")}</DialogTitle>
            <DialogDescription>{task.title}</DialogDescription>
          </DialogHeader>
          <TaskDependenciesPanel
            taskId={task.id}
            projectId={task.projectId}
            canManage={canEditFull}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function TaskRowActions({
  task,
  canEdit,
}: {
  task: Task;
  canEdit: boolean;
}) {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [depsOpen, setDepsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const copyMutation = useMutation({
    mutationFn: () =>
      createTask({
        projectId: task.projectId,
        title: t("copyTitle", { title: task.title }),
        description: task.description,
        status: "todo",
        priority: task.priority,
        assignedTo: task.assignedTo,
        startDate: task.startDate,
        dueDate: task.dueDate,
        estimatedHours: task.estimatedHours,
      }),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => {
      setActionError(err.message || t("createFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTaskRequest(task.id),
    onSuccess: async () => {
      setDeleteOpen(false);
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => {
      setActionError(err.message || t("deleteFailed"));
    },
  });

  if (!canEdit) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={t("tabDependencies")}
        onClick={() => {
          setActionError(null);
          setDepsOpen(true);
        }}
      >
        <GitBranch className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={t("copy")}
        disabled={copyMutation.isPending}
        onClick={() => copyMutation.mutate()}
      >
        <Copy className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={t("delete")}
        onClick={() => {
          setActionError(null);
          setDeleteOpen(true);
        }}
      >
        <Trash2 className="size-4" />
      </Button>

      <Dialog open={depsOpen} onOpenChange={setDepsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("tabDependencies")}</DialogTitle>
            <DialogDescription>{task.title}</DialogDescription>
          </DialogHeader>
          <TaskDependenciesPanel
            taskId={task.id}
            projectId={task.projectId}
            canManage={canEdit}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("confirmDeleteDescription", { title: task.title })}
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.isError ? (
            <p className="text-destructive text-sm">
              {(deleteMutation.error as Error).message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? tCommon("saving") : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {actionError ? (
        <p className="text-destructive mt-1 max-w-[10rem] text-xs">
          {actionError}
        </p>
      ) : null}
    </>
  );
}

function TaskActionsCell({
  task,
  canEdit,
}: {
  task: Task;
  canEdit: boolean;
}) {
  const t = useTranslations("tasks");

  return (
    <TableCell onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center gap-0.5">
        <Link
          href={`/tasks/${task.id}`}
          className="hover:bg-muted inline-flex size-7 items-center justify-center rounded-[min(var(--radius-md),12px)]"
          aria-label={t("openDetails")}
          title={t("openDetails")}
        >
          <ExternalLink className="size-4" />
        </Link>
        <TaskRowActions task={task} canEdit={canEdit} />
      </div>
    </TableCell>
  );
}

function FlatTaskRow({
  task,
  canEdit,
  viewerId,
  showProject,
}: {
  task: Task;
  canEdit: boolean;
  viewerId: string;
  showProject: boolean;
}) {
  const canEditFull = canEdit;
  const canEditStatus = canEdit || task.assignedTo === viewerId;

  return (
    <TableRow>
      <TaskInlineFields
        task={task}
        canEditFull={canEditFull}
        canEditStatus={canEditStatus}
        showProject={showProject}
      />
      <TaskActionsCell task={task} canEdit={canEdit} />
    </TableRow>
  );
}

export function TasksListTable({
  tasks,
  canEdit,
  viewerId,
  showProject = false,
  className,
}: TasksListTableProps) {
  const t = useTranslations("tasks");

  return (
    <div className={cn("overflow-x-auto rounded-lg border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("titleLabel")}</TableHead>
            {showProject ? <TableHead>{t("project")}</TableHead> : null}
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("priority")}</TableHead>
            <TableHead>{t("assignee")}</TableHead>
            <TableHead>{t("estimatedHours")}</TableHead>
            <TableHead>{t("dueDate")}</TableHead>
            <TableHead>{t("tabDependencies")}</TableHead>
            <TableHead className="w-28">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <FlatTaskRow
              key={task.id}
              task={task}
              canEdit={canEdit}
              viewerId={viewerId}
              showProject={showProject}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
