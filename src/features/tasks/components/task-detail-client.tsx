"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

import type { EmployeeRequest } from "@/features/employee-requests/types/employee-request.types";
import {
  updateTaskSchema,
  type UpdateTaskInput,
} from "@/features/tasks/schemas/task.schema";
import type { Task } from "@/features/tasks/types/task.types";
import { selectableTaskStatuses } from "@/features/tasks/types/task.types";
import { AssigneeSelect } from "@/features/tasks/components/assignee-select";
import { TaskActivityPanel } from "@/features/tasks/components/task-activity-panel";
import { TaskAttachmentsPanel } from "@/features/tasks/components/task-attachments-panel";
import { TaskCommentsPanel } from "@/features/tasks/components/task-comments-panel";
import { TaskDependenciesPanel } from "@/features/tasks/components/task-dependencies-panel";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

type TaskDetailClientProps = {
  taskId: string;
  canAssign: boolean;
  canCreate: boolean;
  viewerId: string;
};

type AssigneeOption = {
  id: string;
  fullName: string;
  employeeNumber: string;
};

type DepartmentMemberRow = {
  userId: string;
  user?: {
    id: string;
    fullName: string;
    employeeNumber: string;
  };
};

type ProjectMemberRow = {
  userId: string;
  user?: {
    id: string;
    fullName: string;
    employeeNumber: string;
  };
};

async function fetchTask(id: string): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}`);
  const payload = (await response.json()) as {
    data?: Task;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

async function fetchAssigneeOptions(
  projectId: string,
  departmentId: string,
): Promise<AssigneeOption[]> {
  const [membersRes, deptRes] = await Promise.all([
    fetch(`/api/projects/${projectId}/members`),
    fetch(`/api/departments/${departmentId}/members`),
  ]);

  const membersPayload = (await membersRes.json()) as {
    data?: { items: ProjectMemberRow[] };
    error?: { message: string };
  };
  const deptPayload = (await deptRes.json()) as {
    data?: { items: DepartmentMemberRow[] };
    error?: { message: string };
  };

  if (!membersRes.ok) {
    throw new Error(membersPayload.error?.message ?? "Failed");
  }
  if (!deptRes.ok) {
    throw new Error(deptPayload.error?.message ?? "Failed");
  }

  const byId = new Map<string, AssigneeOption>();
  for (const row of membersPayload.data?.items ?? []) {
    if (row.user) {
      byId.set(row.userId, {
        id: row.user.id,
        fullName: row.user.fullName,
        employeeNumber: row.user.employeeNumber,
      });
    }
  }
  for (const row of deptPayload.data?.items ?? []) {
    if (row.user && !byId.has(row.userId)) {
      byId.set(row.userId, {
        id: row.user.id,
        fullName: row.user.fullName,
        employeeNumber: row.user.employeeNumber,
      });
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName, "ar"),
  );
}

function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <dt className="text-muted-foreground shrink-0 text-xs font-medium">
        {label}
      </dt>
      <dd className="min-w-0 text-sm sm:text-end">{children}</dd>
    </div>
  );
}

export function TaskDetailClient({
  taskId,
  canAssign,
  canCreate,
  viewerId,
}: TaskDetailClientProps) {
  const t = useTranslations("tasks");
  const tReq = useTranslations("employeeRequests");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [extensionOpen, setExtensionOpen] = useState(false);
  const [excusalOpen, setExcusalOpen] = useState(false);
  const [requestedDate, setRequestedDate] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);

  const canEditFull = canAssign || canCreate;
  const taskQuery = useQuery({
    queryKey: ["tasks", taskId],
    queryFn: () => fetchTask(taskId),
  });

  const departmentId = taskQuery.data?.project?.departmentId;
  const assigneesQuery = useQuery({
    queryKey: ["task-assignees", taskQuery.data?.projectId, departmentId],
    queryFn: () =>
      fetchAssigneeOptions(taskQuery.data!.projectId, departmentId!),
    enabled: Boolean(
      canEditFull && taskQuery.data?.projectId && departmentId,
    ),
  });

  const isAssignee = taskQuery.data?.assignedTo === viewerId;
  const canEditStatus = canEditFull || isAssignee;
  const statusLockedByDeps =
    (taskQuery.data?.incompleteDependencyCount ?? 0) > 0;
  const canChangeStatus = canEditStatus && !statusLockedByDeps;

  const pendingRequestsQuery = useQuery({
    queryKey: ["employee-requests", "mine", taskId],
    enabled: isAssignee,
    queryFn: async () => {
      const params = new URLSearchParams({
        taskId,
        status: "pending",
        page: "1",
        pageSize: "25",
      });
      const response = await fetch(`/api/employee-requests?${params}`);
      const payload = (await response.json()) as {
        data?: { items: EmployeeRequest[] };
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed");
      }
      return payload.data?.items ?? [];
    },
  });

  const pendingExtensionRequest = (pendingRequestsQuery.data ?? []).find(
    (r) => r.type === "extension",
  );
  const pendingExcusalRequest = (pendingRequestsQuery.data ?? []).find(
    (r) => r.type === "excusal",
  );
  const hasPendingExtension = Boolean(pendingExtensionRequest);
  const hasPendingExcusal = Boolean(pendingExcusalRequest);

  const extensionMutation = useMutation({
    mutationFn: async () => {
      const trimmedReason = requestReason.trim();
      if (!trimmedReason) {
        throw new Error(tReq("reasonRequired"));
      }

      if (pendingExtensionRequest) {
        const response = await fetch(
          `/api/employee-requests/${pendingExtensionRequest.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requestedDate,
              reason: trimmedReason,
            }),
          },
        );
        const payload = (await response.json()) as {
          error?: { message: string };
        };
        if (!response.ok) {
          throw new Error(payload.error?.message ?? tReq("updateRequest"));
        }
        return;
      }

      const response = await fetch("/api/employee-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          type: "extension",
          requestedDate,
          reason: trimmedReason,
        }),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? tReq("extensionTitle"));
      }
    },
    onSuccess: async () => {
      setSuccessMessage(tReq("extensionSuccess"));
      setRequestError(null);
      setExtensionOpen(false);
      setRequestedDate("");
      setRequestReason("");
      await queryClient.invalidateQueries({
        queryKey: ["employee-requests", "mine", taskId],
      });
    },
    onError: (error: Error) => setRequestError(error.message),
  });

  const excusalMutation = useMutation({
    mutationFn: async () => {
      const trimmedReason = requestReason.trim();
      if (!trimmedReason) {
        throw new Error(tReq("reasonRequired"));
      }

      if (pendingExcusalRequest) {
        const response = await fetch(
          `/api/employee-requests/${pendingExcusalRequest.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reason: trimmedReason,
            }),
          },
        );
        const payload = (await response.json()) as {
          error?: { message: string };
        };
        if (!response.ok) {
          throw new Error(payload.error?.message ?? tReq("updateRequest"));
        }
        return;
      }

      const response = await fetch("/api/employee-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          type: "excusal",
          reason: trimmedReason,
        }),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? tReq("excusalTitle"));
      }
    },
    onSuccess: async () => {
      setSuccessMessage(tReq("excusalSuccess"));
      setRequestError(null);
      setExcusalOpen(false);
      setRequestReason("");
      await queryClient.invalidateQueries({
        queryKey: ["employee-requests", "mine", taskId],
      });
    },
    onError: (error: Error) => setRequestError(error.message),
  });

  const editForm = useForm<UpdateTaskInput>({
    resolver: zodResolver(updateTaskSchema) as never,
    values: taskQuery.data
      ? {
          title: taskQuery.data.title,
          description: taskQuery.data.description ?? "",
          status: taskQuery.data.status,
          priority: taskQuery.data.priority,
          assignedTo: taskQuery.data.assignedTo,
          dueDate: taskQuery.data.dueDate ?? "",
          estimatedHours: taskQuery.data.estimatedHours,
        }
      : undefined,
  });

  const patchMutation = useMutation({
    mutationFn: async (values: UpdateTaskInput) => {
      const { status: _status, startDate: _startDate, ...rest } = values;
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rest,
          assignedTo: rest.assignedTo,
          dueDate: rest.dueDate || null,
          description: rest.description || null,
        }),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("updateFailed"));
      }
    },
    onSuccess: async () => {
      setSuccessMessage(t("updateSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("updateFailed"));
      }
      return status;
    },
    onSuccess: async (status) => {
      editForm.setValue("status", status as UpdateTaskInput["status"]);
      setSuccessMessage(t("statusUpdateSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  if (taskQuery.isLoading) {
    return <LoadingState />;
  }

  if (taskQuery.isError || !taskQuery.data) {
    return (
      <ErrorState
        title={tCommon("errorTitle")}
        description={(taskQuery.error as Error)?.message}
        onRetry={() => void taskQuery.refetch()}
      />
    );
  }

  const task = taskQuery.data;
  const assignees = assigneesQuery.data ?? [];
  const watchedAssignee = editForm.watch("assignedTo");

  function statusLabel(status: string) {
    return t(`status_${status}` as "status_todo");
  }

  function priorityLabel(priority: string) {
    return t(`priority_${priority}` as "priority_low");
  }

  const asideClassName =
    "min-w-0 space-y-4 rounded-xl bg-muted p-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto";
  const mainPanelClassName =
    "space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm";
  const sidePanelClassName =
    "space-y-3 rounded-lg border border-border/80 bg-card p-3 shadow-sm";
  const sectionTitleClassName = "text-sm font-semibold tracking-tight text-primary";

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { label: t("title"), href: "/tasks" },
            ...(task.project
              ? [
                  {
                    label: task.project.name,
                    href: `/projects/${task.projectId}`,
                  },
                ]
              : []),
            { label: task.title },
          ]}
        />
        <PageHeader
          title={task.title}
          description={
            task.projectId && task.project?.name ? (
              <Link
                href={`/projects/${task.projectId}`}
                className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              >
                {task.project.name}
              </Link>
            ) : undefined
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {canChangeStatus ? (
                <select
                  aria-label={t("status")}
                  className="border-input bg-background h-8 rounded-md border px-2 text-sm"
                  value={task.status}
                  disabled={statusMutation.isPending}
                  onChange={(event) =>
                    statusMutation.mutate(event.target.value)
                  }
                >
                  {selectableTaskStatuses(task.status).map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary">{statusLabel(task.status)}</Badge>
                  {statusLockedByDeps ? (
                    <p className="text-muted-foreground max-w-48 text-end text-xs">
                      {t("statusLockedByDependencies")}
                    </p>
                  ) : null}
                </div>
              )}

              {isAssignee ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRequestError(null);
                      if (hasPendingExtension) {
                        setRequestedDate(
                          pendingExtensionRequest?.requestedDate ?? "",
                        );
                        setRequestReason(
                          pendingExtensionRequest?.reason ?? "",
                        );
                      } else {
                        setRequestedDate("");
                        setRequestReason("");
                      }
                      setExtensionOpen(true);
                    }}
                  >
                    {hasPendingExtension
                      ? tReq("pendingExtension")
                      : tReq("requestExtension")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRequestError(null);
                      setRequestReason(
                        hasPendingExcusal
                          ? (pendingExcusalRequest?.reason ?? "")
                          : "",
                      );
                      setExcusalOpen(true);
                    }}
                  >
                    {hasPendingExcusal
                      ? tReq("pendingExcusal")
                      : tReq("requestExcusal")}
                  </Button>
                </>
              ) : null}
            </div>
          }
        />
      </div>

      {successMessage ? (
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {statusMutation.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {(statusMutation.error as Error).message}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_28rem] lg:items-start">
        <section className={`min-w-0 ${mainPanelClassName}`}>
          {canEditFull ? (
            <div className="space-y-3">
              <h2 className={sectionTitleClassName}>{t("detailsTitle")}</h2>
              <div className="space-y-2">
                <Label htmlFor="edit-title">{t("titleLabel")}</Label>
                <Input
                  id="edit-title"
                  form="task-edit-form"
                  {...editForm.register("title")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">{t("descriptionLabel")}</Label>
                <textarea
                  id="edit-description"
                  form="task-edit-form"
                  className="border-input bg-background min-h-28 w-full rounded-md border px-3 py-2 text-sm"
                  {...editForm.register("description")}
                />
              </div>
            </div>
          ) : (
            <>
              <h2 className={sectionTitleClassName}>{t("descriptionLabel")}</h2>
              {task.description ? (
                <p className="text-sm whitespace-pre-wrap text-foreground">
                  {task.description}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t("noDescription")}
                </p>
              )}
            </>
          )}
        </section>

        <aside className={asideClassName}>
          <section className={sidePanelClassName}>
            <h2 className={sectionTitleClassName}>{t("properties")}</h2>
            {canEditFull ? (
              <form
                id="task-edit-form"
                className="space-y-1"
                onSubmit={editForm.handleSubmit((values) => {
                  patchMutation.mutate(values);
                })}
              >
                <dl>
                  <PropertyRow label={t("priority")}>
                    <select
                      id="edit-priority"
                      className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm sm:max-w-40"
                      {...editForm.register("priority")}
                    >
                      <option value="low">{priorityLabel("low")}</option>
                      <option value="medium">{priorityLabel("medium")}</option>
                      <option value="high">{priorityLabel("high")}</option>
                    </select>
                  </PropertyRow>
                  <PropertyRow label={t("assignee")}>
                    <AssigneeSelect
                      id="edit-assignee"
                      value={
                        typeof watchedAssignee === "string"
                          ? watchedAssignee
                          : null
                      }
                      options={assignees}
                      showEmployeeNumber
                      showSelectedHint
                      disabled={!canAssign}
                      onChange={(userId) =>
                        editForm.setValue("assignedTo", userId, {
                          shouldDirty: true,
                        })
                      }
                    />
                  </PropertyRow>
                  <PropertyRow label={t("dueDate")}>
                    <div className="space-y-1 sm:max-w-40">
                      <Input
                        id="edit-due"
                        type="date"
                        className="h-8"
                        max={task.project?.endDate}
                        {...editForm.register("dueDate")}
                      />
                      {task.project?.endDate ? (
                        <p className="text-xs text-muted-foreground">
                          {t("dueDateWithinProjectHint", {
                            date: task.project.endDate,
                          })}
                        </p>
                      ) : null}
                    </div>
                  </PropertyRow>
                  <PropertyRow label={t("estimatedHours")}>
                    <Input
                      id="edit-hours"
                      type="number"
                      step="0.5"
                      min="0.5"
                      required
                      className="h-8 sm:max-w-40"
                      {...editForm.register("estimatedHours", {
                        setValueAs: (value) =>
                          value === "" || value == null
                            ? undefined
                            : Number(value),
                      })}
                    />
                  </PropertyRow>
                </dl>
                {patchMutation.isError ? (
                  <Alert variant="destructive" className="mt-3">
                    <AlertDescription>
                      {(patchMutation.error as Error).message}
                    </AlertDescription>
                  </Alert>
                ) : null}
                <Button
                  type="submit"
                  className="mt-3 w-full"
                  disabled={patchMutation.isPending}
                >
                  {patchMutation.isPending
                    ? tCommon("saving")
                    : tCommon("save")}
                </Button>
              </form>
            ) : (
              <dl>
                <PropertyRow label={t("priority")}>
                  <span className="font-medium">
                    {priorityLabel(task.priority)}
                  </span>
                </PropertyRow>
                <PropertyRow label={t("assignee")}>
                  <span className="font-medium">
                    {task.assignee?.fullName ?? "—"}
                  </span>
                </PropertyRow>
                <PropertyRow label={t("dueDate")}>
                  <span className="font-medium">{task.dueDate ?? "—"}</span>
                </PropertyRow>
                <PropertyRow label={t("estimatedHours")}>
                  <span className="font-medium">{task.estimatedHours}</span>
                </PropertyRow>
              </dl>
            )}
          </section>

          <section className={sidePanelClassName}>
            <h2 className={sectionTitleClassName}>{t("tabDependencies")}</h2>
            <TaskDependenciesPanel
              taskId={taskId}
              projectId={task.projectId}
              canManage={canEditFull}
            />
          </section>

          <section className={sidePanelClassName}>
            <h2 className={sectionTitleClassName}>{t("tabActivity")}</h2>
            <TaskActivityPanel taskId={taskId} />
          </section>
        </aside>

        <div className="min-w-0 space-y-6">
          <section className={mainPanelClassName}>
            <h2 className={sectionTitleClassName}>{t("tabComments")}</h2>
            <TaskCommentsPanel
              taskId={taskId}
              viewerId={viewerId}
              canModerate={canEditFull}
            />
          </section>

          <section className={mainPanelClassName}>
            <h2 className={sectionTitleClassName}>{t("tabAttachments")}</h2>
            <TaskAttachmentsPanel
              taskId={taskId}
              viewerId={viewerId}
              canModerate={canEditFull}
            />
          </section>
        </div>
      </div>

      <Dialog open={extensionOpen} onOpenChange={setExtensionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tReq("extensionTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {hasPendingExtension ? (
              <Alert>
                <AlertDescription>
                  {tReq("editingPendingRequest")}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="extension-date">{tReq("requestedDate")}</Label>
              <Input
                id="extension-date"
                type="date"
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
              />
              {task.project?.endDate ? (
                <p className="text-xs text-muted-foreground">
                  {tReq("extensionBeyondProjectHint")}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="extension-reason">
                {tReq("reason")}
                <span className="text-destructive ms-0.5" aria-hidden>
                  *
                </span>
              </Label>
              <Input
                id="extension-reason"
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                required
              />
            </div>
            {requestError ? (
              <Alert variant="destructive">
                <AlertDescription>{requestError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setExtensionOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={
                !requestedDate ||
                !requestReason.trim() ||
                extensionMutation.isPending
              }
              onClick={() => extensionMutation.mutate()}
            >
              {extensionMutation.isPending
                ? tCommon("saving")
                : hasPendingExtension
                  ? tReq("updateRequest")
                  : tReq("submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={excusalOpen} onOpenChange={setExcusalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tReq("excusalTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {hasPendingExcusal ? (
              <Alert>
                <AlertDescription>
                  {tReq("editingPendingRequest")}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="excusal-reason">
                {tReq("reason")}
                <span className="text-destructive ms-0.5" aria-hidden>
                  *
                </span>
              </Label>
              <Input
                id="excusal-reason"
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                required
              />
            </div>
            {requestError ? (
              <Alert variant="destructive">
                <AlertDescription>{requestError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setExcusalOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={!requestReason.trim() || excusalMutation.isPending}
              onClick={() => excusalMutation.mutate()}
            >
              {excusalMutation.isPending
                ? tCommon("saving")
                : hasPendingExcusal
                  ? tReq("updateRequest")
                  : tReq("submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
