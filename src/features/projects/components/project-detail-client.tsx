"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

import {
  updateProjectSchema,
  type UpdateProjectInput,
} from "@/features/projects/schemas/project.schema";
import {
  createTaskSchema,
  type CreateTaskInput,
} from "@/features/tasks/schemas/task.schema";
import type {
  Project,
  ProjectMember,
} from "@/features/projects/types/project.types";
import type { Task } from "@/features/tasks/types/task.types";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { TabPanel, Tabs } from "@/components/shared/tabs";
import { TasksListTable } from "@/features/tasks/components/tasks-list-table";
import { AssigneeSelect } from "@/features/tasks/components/assignee-select";
import type { AssigneeOption } from "@/features/tasks/components/assignee-select";
import { TaskDependencyPicker } from "@/features/tasks/components/task-dependency-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Alert, AlertDescription } from "@/components/ui/alert";

type ProjectDetailClientProps = {
  projectId: string;
  canManageProject: boolean;
  canManageMembers: boolean;
  canCreateTask: boolean;
  managedDepartmentId: string | null;
  viewerId: string;
};

type DepartmentMemberOption = {
  userId: string;
  user?: {
    id: string;
    fullName: string;
    employeeNumber: string;
  };
};

async function fetchProject(id: string): Promise<Project> {
  const response = await fetch(`/api/projects/${id}`);
  const payload = (await response.json()) as {
    data?: Project;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

async function fetchMembers(id: string): Promise<ProjectMember[]> {
  const response = await fetch(`/api/projects/${id}/members`);
  const payload = (await response.json()) as {
    data?: { items: ProjectMember[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!.items;
}

async function fetchProjectTasks(projectId: string): Promise<Task[]> {
  const params = new URLSearchParams({
    projectId,
    parentTaskId: "null",
    pageSize: "25",
    sortBy: "createdAt",
    sortDir: "desc",
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

async function fetchDepartmentMembers(
  departmentId: string,
): Promise<DepartmentMemberOption[]> {
  const response = await fetch(`/api/departments/${departmentId}/members`);
  const payload = (await response.json()) as {
    data?: { items: DepartmentMemberOption[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!.items;
}

export function ProjectDetailClient({
  projectId,
  canManageProject,
  canManageMembers,
  canCreateTask,
  managedDepartmentId,
  viewerId,
}: ProjectDetailClientProps) {
  const t = useTranslations("projects");
  const tTasks = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [removeMember, setRemoveMember] = useState<ProjectMember | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tasks" | "members">("tasks");

  const projectQuery = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => fetchProject(projectId),
  });

  const membersQuery = useQuery({
    queryKey: ["projects", projectId, "members"],
    queryFn: () => fetchMembers(projectId),
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks", { projectId, parentTaskId: null }],
    queryFn: () => fetchProjectTasks(projectId),
  });

  const departmentMembersQuery = useQuery({
    queryKey: ["departments", projectQuery.data?.departmentId, "members"],
    queryFn: () => fetchDepartmentMembers(projectQuery.data!.departmentId),
    enabled:
      Boolean(projectQuery.data?.departmentId) &&
      (addMemberOpen || createTaskOpen),
  });

  const editForm = useForm<UpdateProjectInput>({
    resolver: zodResolver(updateProjectSchema) as never,
    values: projectQuery.data
      ? {
          name: projectQuery.data.name,
          description: projectQuery.data.description,
          status: projectQuery.data.status,
          priority: projectQuery.data.priority,
          startDate: projectQuery.data.startDate,
          endDate: projectQuery.data.endDate,
        }
      : undefined,
  });

  const patchMutation = useMutation({
    mutationFn: async (values: UpdateProjectInput) => {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("updateFailed"));
      }
    },
    onSuccess: async () => {
      setEditOpen(false);
      setArchiveOpen(false);
      setSuccessMessage(t("updateSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("addMemberFailed"));
      }
    },
    onSuccess: async () => {
      setAddMemberOpen(false);
      setSelectedMemberId("");
      setSuccessMessage(t("addMemberSuccess"));
      await queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "members"],
      });
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(
        `/api/projects/${projectId}/members/${userId}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("removeMemberFailed"));
      }
    },
    onSuccess: async () => {
      setRemoveMember(null);
      setSuccessMessage(t("removeMemberSuccess"));
      await queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "members"],
      });
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });

  const createTaskForm = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema) as never,
    defaultValues: {
      projectId,
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

  const createTaskMutation = useMutation({
    mutationFn: async (values: CreateTaskInput) => {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, projectId }),
      });
      const payload = (await response.json()) as {
        data?: Task;
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? tTasks("createFailed"));
      }
      return payload.data!;
    },
    onSuccess: async () => {
      setCreateTaskOpen(false);
      createTaskForm.reset({
        projectId,
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
      });
      setTaskError(null);
      setSuccessMessage(tTasks("createSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: Error) => {
      setTaskError(error.message);
    },
  });

  if (projectQuery.isLoading) {
    return <LoadingState />;
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <ErrorState
        title={tCommon("errorTitle")}
        description={(projectQuery.error as Error)?.message}
        onRetry={() => void projectQuery.refetch()}
      />
    );
  }

  const project = projectQuery.data;
  const members = membersQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const memberUserIds = new Set(members.map((m) => m.userId));
  const availableMembers = (departmentMembersQuery.data ?? []).filter(
    (m) => !memberUserIds.has(m.userId),
  );
  const allowMemberActions =
    canManageMembers &&
    (canManageProject ||
      (managedDepartmentId != null &&
        managedDepartmentId === project.departmentId));
  const allowProjectEdit = canManageProject;

  const createTaskAssigneeOptions: AssigneeOption[] = (() => {
    const byId = new Map<string, AssigneeOption>();
    for (const member of departmentMembersQuery.data ?? []) {
      if (member.user) {
        byId.set(member.userId, {
          id: member.user.id,
          fullName: member.user.fullName,
          employeeNumber: member.user.employeeNumber,
        });
      }
    }
    for (const member of members) {
      if (member.user && !byId.has(member.userId)) {
        byId.set(member.userId, {
          id: member.user.id,
          fullName: member.user.fullName,
          employeeNumber: member.user.employeeNumber,
        });
      }
    }
    return [...byId.values()].sort((a, b) =>
      a.fullName.localeCompare(b.fullName),
    );
  })();
  const watchedCreateAssignee = createTaskForm.watch("assignedTo");

  function statusLabel(status: string) {
    return t(`status_${status}` as "status_draft");
  }

  function priorityLabel(priority: string) {
    return t(`priority_${priority}` as "priority_low");
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { label: t("title"), href: "/projects" },
            ...(project.department
              ? [
                  {
                    label: project.department.name,
                    href: `/departments/${project.departmentId}`,
                  },
                ]
              : []),
            { label: project.name },
          ]}
        />
        <PageHeader
          title={project.name}
          description={project.department?.name ?? t("detailsTitle")}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/projects/${projectId}/board`}
                className="border-border bg-background inline-flex h-8 items-center rounded-lg border px-2.5 text-sm hover:bg-muted"
              >
                {t("kanban")}
              </Link>
              <Link
                href={`/projects/${projectId}/gantt`}
                className="border-border bg-background inline-flex h-8 items-center rounded-lg border px-2.5 text-sm hover:bg-muted"
              >
                {t("gantt")}
              </Link>
              {allowProjectEdit ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditOpen(true)}
                  >
                    {t("edit")}
                  </Button>
                  {project.status !== "archived" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setArchiveOpen(true)}
                    >
                      {t("archive")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => patchMutation.mutate({ status: "active" })}
                    >
                      {t("unarchive")}
                    </Button>
                  )}
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">{t("status")}</p>
          <Badge className="mt-2" variant="secondary">
            {statusLabel(project.status)}
          </Badge>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">{t("priority")}</p>
          <p className="mt-2 font-medium">{priorityLabel(project.priority)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">{t("startDate")}</p>
          <p className="mt-2 font-medium">{project.startDate ?? "—"}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">{t("endDate")}</p>
          <p className="mt-2 font-medium">{project.endDate ?? "—"}</p>
        </div>
      </div>

      {project.description ? (
        <p className="text-muted-foreground text-sm whitespace-pre-wrap">
          {project.description}
        </p>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(id) => setActiveTab(id as "tasks" | "members")}
        items={[
          {
            id: "tasks",
            label: tTasks("title"),
            count: tasks.length,
          },
          {
            id: "members",
            label: t("members"),
            count: members.length,
          },
        ]}
        actions={
          activeTab === "tasks" ? (
            canCreateTask && project.status !== "archived" ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setCreateTaskOpen(true)}
              >
                {tTasks("create")}
              </Button>
            ) : null
          ) : allowMemberActions ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setAddMemberOpen(true)}
            >
              {t("addMember")}
            </Button>
          ) : null
        }
      >
        <TabPanel when="tasks" active={activeTab} className="space-y-3">
          {tasksQuery.isLoading ? <LoadingState /> : null}
          {tasks.length === 0 && !tasksQuery.isLoading ? (
            <EmptyState
              title={tTasks("emptyTitle")}
              description={tTasks("emptyDescription")}
            />
          ) : (
            <TasksListTable
              tasks={tasks}
              canEdit={canCreateTask}
              viewerId={viewerId}
            />
          )}
        </TabPanel>

        <TabPanel when="members" active={activeTab} className="space-y-3">
          {membersQuery.isLoading ? <LoadingState /> : null}
          {members.length === 0 && !membersQuery.isLoading ? (
            <EmptyState
              title={t("emptyMembersTitle")}
              description={t("emptyMembersDescription")}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("memberName")}</TableHead>
                    <TableHead>{t("employeeNumber")}</TableHead>
                    {allowMemberActions ? (
                      <TableHead>{t("actions")}</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>{member.user?.fullName ?? "—"}</TableCell>
                      <TableCell>
                        {member.user?.employeeNumber ?? "—"}
                      </TableCell>
                      {allowMemberActions ? (
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setRemoveMember(member)}
                          >
                            {t("removeMember")}
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabPanel>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={editForm.handleSubmit((values) =>
              patchMutation.mutate(values),
            )}
          >
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t("name")}</Label>
              <Input id="edit-name" {...editForm.register("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{t("descriptionLabel")}</Label>
              <textarea
                id="edit-description"
                className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                {...editForm.register("description")}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-status">{t("status")}</Label>
                <select
                  id="edit-status"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  {...editForm.register("status")}
                >
                  <option value="draft">{statusLabel("draft")}</option>
                  <option value="active">{statusLabel("active")}</option>
                  <option value="completed">{statusLabel("completed")}</option>
                  <option value="archived">{statusLabel("archived")}</option>
                </select>
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
                <Label htmlFor="edit-start">{t("startDate")}</Label>
                <Input
                  id="edit-start"
                  type="date"
                  {...editForm.register("startDate")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end">{t("endDate")}</Label>
                <Input
                  id="edit-end"
                  type="date"
                  {...editForm.register("endDate")}
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={patchMutation.isPending}>
                {patchMutation.isPending ? tCommon("saving") : tCommon("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addMember")}</DialogTitle>
            <DialogDescription>{t("addMemberDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={selectedMemberId}
              onChange={(event) => setSelectedMemberId(event.target.value)}
            >
              <option value="">{t("selectMember")}</option>
              {availableMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user?.fullName ?? member.userId}
                </option>
              ))}
            </select>
            {addMemberMutation.isError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {(addMemberMutation.error as Error).message}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddMemberOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={!selectedMemberId || addMemberMutation.isPending}
              onClick={() => addMemberMutation.mutate(selectedMemberId)}
            >
              {addMemberMutation.isPending ? tCommon("saving") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(removeMember)}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveMember(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmRemoveMemberTitle")}</DialogTitle>
            <DialogDescription>
              {t("confirmRemoveMemberDescription", {
                name: removeMember?.user?.fullName ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveMember(null)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={removeMemberMutation.isPending}
              onClick={() => {
                if (removeMember) {
                  removeMemberMutation.mutate(removeMember.userId);
                }
              }}
            >
              {t("removeMember")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmArchiveTitle")}</DialogTitle>
            <DialogDescription>
              {t("confirmArchiveDescription", { name: project.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setArchiveOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={patchMutation.isPending}
              onClick={() => patchMutation.mutate({ status: "archived" })}
            >
              {t("archive")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tTasks("createTitle")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={createTaskForm.handleSubmit((values) => {
              setTaskError(null);
              createTaskMutation.mutate(values);
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="task-title">{tTasks("titleLabel")}</Label>
              <Input id="task-title" {...createTaskForm.register("title")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">
                {tTasks("descriptionLabel")}
              </Label>
              <textarea
                id="task-description"
                className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                {...createTaskForm.register("description")}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-priority">{tTasks("priority")}</Label>
                <select
                  id="task-priority"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  {...createTaskForm.register("priority")}
                >
                  <option value="low">{t("priority_low")}</option>
                  <option value="medium">{t("priority_medium")}</option>
                  <option value="high">{t("priority_high")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-status">{tTasks("status")}</Label>
                <select
                  id="task-status"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  {...createTaskForm.register("status")}
                >
                  <option value="todo">{tTasks("status_todo")}</option>
                  <option value="in_progress">
                    {tTasks("status_in_progress")}
                  </option>
                  <option value="blocked">{tTasks("status_blocked")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-assignee">{tTasks("assignee")}</Label>
                <AssigneeSelect
                  id="task-assignee"
                  value={
                    typeof watchedCreateAssignee === "string"
                      ? watchedCreateAssignee
                      : null
                  }
                  options={createTaskAssigneeOptions}
                  onChange={(userId) =>
                    createTaskForm.setValue("assignedTo", userId, {
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-start">{tTasks("startDate")}</Label>
                <Input
                  id="task-start"
                  type="date"
                  {...createTaskForm.register("startDate")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-due">{tTasks("dueDate")}</Label>
                <Input
                  id="task-due"
                  type="date"
                  {...createTaskForm.register("dueDate")}
                />
              </div>
            </div>
            <TaskDependencyPicker
              projectId={projectId}
              parentTaskId={null}
              value={createTaskForm.watch("dependsOnTaskIds") ?? []}
              onChange={(ids) =>
                createTaskForm.setValue("dependsOnTaskIds", ids)
              }
            />
            {taskError ? (
              <Alert variant="destructive">
                <AlertDescription>{taskError}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateTaskOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={createTaskMutation.isPending}>
                {createTaskMutation.isPending
                  ? tCommon("saving")
                  : tCommon("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
