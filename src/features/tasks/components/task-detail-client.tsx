"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

import {
  createTaskSchema,
  updateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@/features/tasks/schemas/task.schema";
import type { Task } from "@/features/tasks/types/task.types";
import { AssigneeSelect } from "@/features/tasks/components/assignee-select";
import { TaskActivityPanel } from "@/features/tasks/components/task-activity-panel";
import { TaskDependenciesPanel } from "@/features/tasks/components/task-dependencies-panel";
import { TaskDependencyPicker } from "@/features/tasks/components/task-dependency-picker";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const TASK_STATUSES = [
  "todo",
  "in_progress",
  "blocked",
  "completed",
] as const;

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

async function fetchSubtasks(parentTaskId: string): Promise<Task[]> {
  const params = new URLSearchParams({
    parentTaskId,
    pageSize: "100",
    sortBy: "createdAt",
    sortDir: "asc",
  });
  const response = await fetch(`/api/tasks?${params.toString()}`);
  const payload = (await response.json()) as {
    data?: { items: Task[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!.items;
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
  const [subtaskOpen, setSubtaskOpen] = useState(false);
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

  const subtasksQuery = useQuery({
    queryKey: ["tasks", { parentTaskId: taskId }],
    queryFn: () => fetchSubtasks(taskId),
    enabled: Boolean(taskQuery.data && !taskQuery.data.parentTaskId),
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
        data?: { items: { type: string }[] };
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed");
      }
      return payload.data?.items ?? [];
    },
  });

  const hasPendingExtension = (pendingRequestsQuery.data ?? []).some(
    (r) => r.type === "extension",
  );
  const hasPendingExcusal = (pendingRequestsQuery.data ?? []).some(
    (r) => r.type === "excusal",
  );

  const extensionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/employee-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          type: "extension",
          requestedDate,
          reason: requestReason || null,
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
      const response = await fetch("/api/employee-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          type: "excusal",
          reason: requestReason || null,
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
        }
      : undefined,
  });

  const subtaskForm = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema) as never,
    defaultValues: {
      projectId: "",
      parentTaskId: null,
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      assignedTo: null,
      startDate: null,
      dueDate: null,
      estimatedHours: null,
      dependsOnTaskIds: [],
    },
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

  const createSubtaskMutation = useMutation({
    mutationFn: async (values: CreateTaskInput) => {
      const task = taskQuery.data!;
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          projectId: task.projectId,
          parentTaskId: task.id,
        }),
      });
      const payload = (await response.json()) as {
        data?: Task;
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("createFailed"));
      }
      return payload.data!;
    },
    onSuccess: async () => {
      setSubtaskOpen(false);
      subtaskForm.reset();
      setSuccessMessage(t("subtaskCreateSuccess"));
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
  const subtasks = subtasksQuery.data ?? [];
  const isRoot = !task.parentTaskId;
  const assignees = assigneesQuery.data ?? [];
  const watchedAssignee = editForm.watch("assignedTo");
  const watchedSubtaskAssignee = subtaskForm.watch("assignedTo");
  const watchedSubtaskDependsOn = subtaskForm.watch("dependsOnTaskIds") ?? [];

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
                <Badge variant="secondary">{tReq("pendingExtension")}</Badge>
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
                <Badge variant="secondary">{tReq("pendingExcusal")}</Badge>
              ) : null}
              {canCreate && isRoot ? (
                <Button
                  type="button"
                  onClick={() => {
                    subtaskForm.reset({
                      projectId: task.projectId,
                      parentTaskId: task.id,
                      title: "",
                      description: "",
                      status: "todo",
                      priority: "medium",
                      assignedTo: null,
                      startDate: null,
                      dueDate: null,
                      estimatedHours: null,
                      dependsOnTaskIds: [],
                    });
                    setSubtaskOpen(true);
                  }}
                >
                  {t("addSubtask")}
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
                    const payload = taskQuery.data?.parentTaskId
                      ? values
                      : { ...values, estimatedHours: undefined };
                    patchMutation.mutate(payload);
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
                        {TASK_STATUSES.map((status) => (
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
                      {!taskQuery.data?.parentTaskId ? (
                        <>
                          <Input
                            id="edit-hours"
                            type="number"
                            value={taskQuery.data?.estimatedHours ?? 0}
                            disabled
                            readOnly
                          />
                          <p className="text-muted-foreground text-xs">
                            {t("hoursFromSubtasks")}
                          </p>
                        </>
                      ) : (
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
                      )}
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
                        {TASK_STATUSES.map((status) => (
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
                      {!task.parentTaskId
                        ? (task.estimatedHours ?? 0)
                        : task.estimatedHours != null
                          ? task.estimatedHours
                          : "—"}
                    </p>
                    {!task.parentTaskId ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {t("hoursFromSubtasks")}
                      </p>
                    ) : null}
                  </div>
                </div>
                {task.description ? (
                  <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                    {task.description}
                  </p>
                ) : null}
              </>
            )}

            {task.parentTaskId ? (
              <p className="text-sm">
                <Link
                  href={`/tasks/${task.parentTaskId}`}
                  className="underline-offset-4 hover:underline"
                >
                  {t("viewParent")}
                </Link>
              </p>
            ) : null}

            {isRoot ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{t("subtasks")}</h2>
                  {canCreate ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        subtaskForm.reset({
                          projectId: task.projectId,
                          parentTaskId: task.id,
                          title: "",
                          description: "",
                          status: "todo",
                          priority: "medium",
                          assignedTo: null,
                          startDate: null,
                          dueDate: null,
                          estimatedHours: null,
                          dependsOnTaskIds: [],
                        });
                        setSubtaskOpen(true);
                      }}
                    >
                      {t("addSubtask")}
                    </Button>
                  ) : null}
                </div>
                {subtasksQuery.isLoading ? <LoadingState /> : null}
                {subtasks.length === 0 && !subtasksQuery.isLoading ? (
                  <EmptyState
                    title={t("emptySubtasksTitle")}
                    description={t("emptySubtasksDescription")}
                  />
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("titleLabel")}</TableHead>
                          <TableHead>{t("status")}</TableHead>
                          <TableHead>{t("dueDate")}</TableHead>
                          <TableHead>{t("assignee")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subtasks.map((subtask) => (
                          <TableRow key={subtask.id}>
                            <TableCell>
                              <Link
                                href={`/tasks/${subtask.id}`}
                                className="font-medium underline-offset-4 hover:underline"
                              >
                                {subtask.title}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {statusLabel(subtask.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>{subtask.dueDate ?? "—"}</TableCell>
                            <TableCell>
                              {subtask.assignee?.fullName ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>
            ) : null}
          </div>
        </TabPanel>

        <TabPanel when="dependencies" active={activeTab}>
          <TaskDependenciesPanel
            taskId={taskId}
            projectId={task.projectId}
            parentTaskId={task.parentTaskId}
            canManage={canEditFull}
          />
        </TabPanel>

        <TabPanel when="activity" active={activeTab}>
          <TaskActivityPanel taskId={taskId} />
        </TabPanel>
      </Tabs>

      <Dialog open={subtaskOpen} onOpenChange={setSubtaskOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("addSubtask")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={subtaskForm.handleSubmit((values) =>
              createSubtaskMutation.mutate(values),
            )}
          >
            <div className="space-y-2">
              <Label htmlFor="subtask-title">{t("titleLabel")}</Label>
              <Input id="subtask-title" {...subtaskForm.register("title")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtask-description">
                {t("descriptionLabel")}
              </Label>
              <textarea
                id="subtask-description"
                className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                {...subtaskForm.register("description")}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subtask-priority">{t("priority")}</Label>
                <select
                  id="subtask-priority"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  {...subtaskForm.register("priority")}
                >
                  <option value="low">{priorityLabel("low")}</option>
                  <option value="medium">{priorityLabel("medium")}</option>
                  <option value="high">{priorityLabel("high")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subtask-assignee">{t("assignee")}</Label>
                <AssigneeSelect
                  id="subtask-assignee"
                  value={
                    typeof watchedSubtaskAssignee === "string"
                      ? watchedSubtaskAssignee
                      : null
                  }
                  options={assignees}
                  disabled={!canAssign}
                  onChange={(userId) =>
                    subtaskForm.setValue("assignedTo", userId, {
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subtask-start">{t("startDate")}</Label>
                <Input
                  id="subtask-start"
                  type="date"
                  {...subtaskForm.register("startDate")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subtask-due">{t("dueDate")}</Label>
                <Input
                  id="subtask-due"
                  type="date"
                  {...subtaskForm.register("dueDate")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subtask-hours">{t("estimatedHours")}</Label>
                <Input
                  id="subtask-hours"
                  type="number"
                  step="0.5"
                  min="0"
                  {...subtaskForm.register("estimatedHours", {
                    setValueAs: (value) =>
                      value === "" || value == null ? null : Number(value),
                  })}
                />
              </div>
            </div>
            <TaskDependencyPicker
              projectId={task.projectId}
              parentTaskId={task.id}
              value={watchedSubtaskDependsOn}
              onChange={(ids) =>
                subtaskForm.setValue("dependsOnTaskIds", ids)
              }
            />
            {createSubtaskMutation.isError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {(createSubtaskMutation.error as Error).message}
                </AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSubtaskOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={createSubtaskMutation.isPending}
              >
                {createSubtaskMutation.isPending
                  ? tCommon("saving")
                  : tCommon("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={extensionOpen} onOpenChange={setExtensionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tReq("extensionTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
              <Label htmlFor="extension-reason">{tReq("reason")}</Label>
              <Input
                id="extension-reason"
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
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
              disabled={!requestedDate || extensionMutation.isPending}
              onClick={() => extensionMutation.mutate()}
            >
              {tReq("submit")}
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
            <div className="space-y-2">
              <Label htmlFor="excusal-reason">{tReq("reason")}</Label>
              <Input
                id="excusal-reason"
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
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
              disabled={excusalMutation.isPending}
              onClick={() => excusalMutation.mutate()}
            >
              {tReq("submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
