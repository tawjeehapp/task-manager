"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { TabPanel, Tabs } from "@/components/shared/tabs";
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
  const [activeTab, setActiveTab] = useState("overview");
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
    queryKey: [
      "task-assignees",
      taskQuery.data?.projectId,
      departmentId,
    ],
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
          startDate: taskQuery.data.startDate ?? "",
          dueDate: taskQuery.data.dueDate ?? "",
          estimatedHours: taskQuery.data.estimatedHours,
          progressPercentage: taskQuery.data.progressPercentage,
        }
      : undefined,
  });

  const patchMutation = useMutation({
    mutationFn: async (values: UpdateTaskInput) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          assignedTo: values.assignedTo || null,
          startDate: values.startDate || null,
          dueDate: values.dueDate || null,
          description: values.description || null,
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
    },
    onSuccess: async () => {
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
          description={task.project?.name ?? undefined}
          actions={
            <div className="flex flex-wrap gap-2">
              {task.projectId ? (
                <Link
                  href={`/projects/${task.projectId}`}
                  className="border-border bg-background inline-flex h-8 items-center rounded-lg border px-2.5 text-sm hover:bg-muted"
                >
                  {t("viewProject")}
                </Link>
              ) : null}
              {isAssignee && !hasPendingExtension ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRequestError(null);
                    setRequestedDate("");
                    setRequestReason("");
                    setExtensionOpen(true);
                  }}
                >
                  {tReq("requestExtension")}
                </Button>
              ) : null}
              {isAssignee && hasPendingExtension ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRequestError(null);
                    setRequestedDate(
                      pendingExtensionRequest?.requestedDate ?? "",
                    );
                    setRequestReason(pendingExtensionRequest?.reason ?? "");
                    setExtensionOpen(true);
                  }}
                >
                  {tReq("pendingExtension")}
                </Button>
              ) : null}
              {isAssignee && !hasPendingExcusal ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRequestError(null);
                    setRequestReason("");
                    setExcusalOpen(true);
                  }}
                >
                  {tReq("requestExcusal")}
                </Button>
              ) : null}
              {isAssignee && hasPendingExcusal ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRequestError(null);
                    setRequestReason(pendingExcusalRequest?.reason ?? "");
                    setExcusalOpen(true);
                  }}
                >
                  {tReq("pendingExcusal")}
                </Button>
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

      <Tabs
        items={[
          { id: "overview", label: t("tabOverview") },
          { id: "dependencies", label: t("tabDependencies") },
          { id: "comments", label: t("tabComments") },
          { id: "attachments", label: t("tabAttachments") },
          { id: "activity", label: t("tabActivity") },
        ]}
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabPanel when="overview" active={activeTab}>
          <div className="space-y-6">
            {canEditFull ? (
              <section className="space-y-4 rounded-lg border p-4">
                <h2 className="text-lg font-semibold">{t("editTitle")}</h2>
                <form
                  className="space-y-4"
                  onSubmit={editForm.handleSubmit((values) => {
                    patchMutation.mutate(values);
                  })}
                >
                  <div className="space-y-2">
                    <Label htmlFor="edit-title">{t("titleLabel")}</Label>
                    <Input id="edit-title" {...editForm.register("title")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">
                      {t("descriptionLabel")}
                    </Label>
                    <textarea
                      id="edit-description"
                      className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                      {...editForm.register("description")}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="edit-status">{t("status")}</Label>
                      <select
                        id="edit-status"
                        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                        disabled={statusLockedByDeps}
                        title={
                          statusLockedByDeps
                            ? t("statusLockedByDependencies")
                            : undefined
                        }
                        {...editForm.register("status")}
                      >
                        {selectableTaskStatuses(editForm.watch("status") ?? task.status).map((status) => (
                          <option key={status} value={status}>
                            {statusLabel(status)}
                          </option>
                        ))}
                      </select>
                      {statusLockedByDeps ? (
                        <p className="text-muted-foreground text-xs">
                          {t("statusLockedByDependencies")}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-priority">{t("priority")}</Label>
                      <select
                        id="edit-priority"
                        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                        {...editForm.register("priority")}
                      >
                        <option value="low">{priorityLabel("low")}</option>
                        <option value="medium">{priorityLabel("medium")}</option>
                        <option value="high">{priorityLabel("high")}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-assignee">{t("assignee")}</Label>
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
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-start">{t("startDate")}</Label>
                      <Input
                        id="edit-start"
                        type="date"
                        {...editForm.register("startDate")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-due">{t("dueDate")}</Label>
                      <Input
                        id="edit-due"
                        type="date"
                        {...editForm.register("dueDate")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-hours">{t("estimatedHours")}</Label>
                      <Input
                        id="edit-hours"
                        type="number"
                        step="0.5"
                        min="0"
                        {...editForm.register("estimatedHours", {
                          setValueAs: (value) =>
                            value === "" || value == null
                              ? null
                              : Number(value),
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-progress">
                        {t("progressPercentage")}
                      </Label>
                      <Input
                        id="edit-progress"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        {...editForm.register("progressPercentage", {
                          setValueAs: (value) =>
                            value === "" || value == null
                              ? undefined
                              : Number(value),
                        })}
                      />
                    </div>
                  </div>
                  {patchMutation.isError ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {(patchMutation.error as Error).message}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <Button type="submit" disabled={patchMutation.isPending}>
                    {patchMutation.isPending
                      ? tCommon("saving")
                      : tCommon("save")}
                  </Button>
                </form>
              </section>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">
                      {t("status")}
                    </p>
                    {canChangeStatus ? (
                      <select
                        className="border-input bg-background mt-2 h-9 w-full rounded-md border px-3 text-sm"
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
                      <>
                        <Badge className="mt-2" variant="secondary">
                          {statusLabel(task.status)}
                        </Badge>
                        {statusLockedByDeps ? (
                          <p className="text-muted-foreground mt-1 text-xs">
                            {t("statusLockedByDependencies")}
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">
                      {t("priority")}
                    </p>
                    <p className="mt-2 font-medium">
                      {priorityLabel(task.priority)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">
                      {t("assignee")}
                    </p>
                    <p className="mt-2 font-medium">
                      {task.assignee?.fullName ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">
                      {t("startDate")}
                    </p>
                    <p className="mt-2 font-medium">{task.startDate ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">
                      {t("dueDate")}
                    </p>
                    <p className="mt-2 font-medium">{task.dueDate ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">
                      {t("estimatedHours")}
                    </p>
                    <p className="mt-2 font-medium">
                      {task.estimatedHours != null ? task.estimatedHours : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">
                      {t("progressPercentage")}
                    </p>
                    <p className="mt-2 font-medium">
                      {task.progressPercentage ?? 0}%
                    </p>
                  </div>
                </div>
                {task.description ? (
                  <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                    {task.description}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </TabPanel>

        <TabPanel when="dependencies" active={activeTab}>
          <TaskDependenciesPanel
            taskId={taskId}
            projectId={task.projectId}
            canManage={canEditFull}
          />
        </TabPanel>

        <TabPanel when="comments" active={activeTab}>
          <TaskCommentsPanel
            taskId={taskId}
            viewerId={viewerId}
            canModerate={canEditFull}
          />
        </TabPanel>

        <TabPanel when="attachments" active={activeTab}>
          <TaskAttachmentsPanel
            taskId={taskId}
            viewerId={viewerId}
            canModerate={canEditFull}
          />
        </TabPanel>

        <TabPanel when="activity" active={activeTab}>
          <TaskActivityPanel taskId={taskId} />
        </TabPanel>
      </Tabs>

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
