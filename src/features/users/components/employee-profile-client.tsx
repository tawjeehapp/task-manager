"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

import {
  updateUserSchema,
  type UpdateUserInput,
} from "@/features/users/schemas/user.schema";
import type { Department } from "@/features/departments/types/department.types";
import type { Project } from "@/features/projects/types/project.types";
import type { Task } from "@/features/tasks/types/task.types";
import type { UserListItem } from "@/features/users/types/user.types";
import {
  EmployeeProfileAttendancePanel,
  EmployeeProfileLeavePanel,
  EmployeeProfileRequestsPanel,
} from "@/features/users/components/employee-profile-activity";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { TabPanel, Tabs } from "@/components/shared/tabs";
import { TasksListTable } from "@/features/tasks/components/tasks-list-table";
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

type ProfileTab =
  | "projects"
  | "tasks"
  | "attendance"
  | "leave"
  | "requests";

function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/70 py-2.5 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-sm font-medium sm:text-end">{children}</dd>
    </div>
  );
}

type EmployeeProfileClientProps = {
  userId: string;
  canManage: boolean;
  isAdmin: boolean;
  canEditTasks: boolean;
  canApproveAttendance: boolean;
  canApproveLeave: boolean;
  canApproveEmployeeRequest: boolean;
  currentUserId: string;
};

async function fetchUser(id: string): Promise<UserListItem> {
  const response = await fetch(`/api/users/${id}`);
  const payload = (await response.json()) as {
    data?: UserListItem;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

async function fetchDepartments(): Promise<Department[]> {
  const response = await fetch("/api/departments");
  const payload = (await response.json()) as {
    data?: { items: Department[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!.items;
}

async function fetchUserProjects(userId: string): Promise<Project[]> {
  const params = new URLSearchParams({
    memberUserId: userId,
    pageSize: "100",
    includeArchived: "true",
    sortBy: "createdAt",
    sortDir: "desc",
  });
  const response = await fetch(`/api/projects?${params.toString()}`);
  const payload = (await response.json()) as {
    data?: { items: Project[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!.items;
}

async function fetchUserTasks(userId: string): Promise<Task[]> {
  const params = new URLSearchParams({
    assignee: userId,
    pageSize: "100",
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

export function EmployeeProfileClient({
  userId,
  canManage,
  isAdmin,
  canEditTasks,
  canApproveAttendance,
  canApproveLeave,
  canApproveEmployeeRequest,
  currentUserId,
}: EmployeeProfileClientProps) {
  const t = useTranslations("employees");
  const tProjects = useTranslations("projects");
  const tTasks = useTranslations("tasks");
  const tRoles = useTranslations("roles");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const isSelf = userId === currentUserId;

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [activeTab, setActiveTab] = useState<ProfileTab>("projects");
  const [confirmAction, setConfirmAction] = useState<
    "delete" | "reset" | "deactivate" | "activate" | "removeDepartment" | null
  >(null);

  const userQuery = useQuery({
    queryKey: ["users", userId],
    queryFn: () => fetchUser(userId),
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments", "active"],
    queryFn: fetchDepartments,
    enabled: isAdmin && membershipOpen,
  });

  const projectsQuery = useQuery({
    queryKey: ["projects", { memberUserId: userId }],
    queryFn: () => fetchUserProjects(userId),
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks", { assignee: userId }],
    queryFn: () => fetchUserTasks(userId),
  });

  const attendanceCountQuery = useQuery({
    queryKey: ["attendance", "profile-count", userId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "25",
        userId,
        sortBy: "date",
        sortDir: "desc",
      });
      const response = await fetch(`/api/attendance?${params}`);
      const payload = (await response.json()) as {
        data?: { total: number };
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed");
      }
      return payload.data?.total ?? 0;
    },
  });

  const leaveCountQuery = useQuery({
    queryKey: ["leave-requests", "profile-count", userId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "25",
        userId,
        sortBy: "created_at",
        sortDir: "desc",
      });
      const response = await fetch(`/api/leave-requests?${params}`);
      const payload = (await response.json()) as {
        data?: { total: number };
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed");
      }
      return payload.data?.total ?? 0;
    },
  });

  const requestsCountQuery = useQuery({
    queryKey: ["employee-requests", "profile-count", userId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "25",
        userId,
        sortBy: "created_at",
        sortDir: "desc",
      });
      const response = await fetch(`/api/employee-requests?${params}`);
      const payload = (await response.json()) as {
        data?: { total: number };
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed");
      }
      return payload.data?.total ?? 0;
    },
  });

  const user = userQuery.data;
  const projects = projectsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const attendanceTotal = attendanceCountQuery.data ?? 0;
  const leaveTotal = leaveCountQuery.data ?? 0;
  const requestsTotal = requestsCountQuery.data ?? 0;

  const editForm = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema) as never,
    values: {
      fullName: user?.fullName ?? "",
      phone: user?.phone ?? "",
      role: user?.role ?? "employee",
      weeklyCapacityHours: user?.weeklyCapacityHours ?? 40,
    },
  });

  const patchMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("updateFailed"));
      }
    },
    onSuccess: async () => {
      setConfirmAction(null);
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("deleteFailed"));
      }
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/users/${userId}/reset-password`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("resetFailed"));
      }
    },
    onSuccess: async () => {
      setConfirmAction(null);
      await queryClient.invalidateQueries({ queryKey: ["users", userId] });
    },
  });

  const membershipMutation = useMutation({
    mutationFn: async ({
      departmentId,
      mode,
    }: {
      departmentId?: string;
      mode: "assign" | "move" | "remove";
    }) => {
      if (!user) {
        throw new Error(t("membershipFailed"));
      }
      if (mode === "remove") {
        if (!user.currentDepartment) {
          throw new Error(t("membershipFailed"));
        }
        const response = await fetch(
          `/api/departments/${user.currentDepartment.id}/members/${user.id}`,
          { method: "DELETE" },
        );
        const payload = (await response.json()) as {
          error?: { message: string };
        };
        if (!response.ok) {
          throw new Error(payload.error?.message ?? t("membershipFailed"));
        }
        return mode;
      }
      if (!departmentId) {
        throw new Error(t("membershipFailed"));
      }
      if (user.currentDepartment) {
        const response = await fetch("/api/departments/members/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            toDepartmentId: departmentId,
          }),
        });
        const payload = (await response.json()) as {
          error?: { message: string };
        };
        if (!response.ok) {
          throw new Error(payload.error?.message ?? t("membershipFailed"));
        }
        return "move" as const;
      }
      const response = await fetch(`/api/departments/${departmentId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("membershipFailed"));
      }
      return "assign" as const;
    },
    onSuccess: async (mode) => {
      setMembershipOpen(false);
      setConfirmAction(null);
      setSelectedDepartmentId("");
      if (!user) {
        return;
      }
      if (mode === "remove") {
        setSuccessMessage(
          t("removeDepartmentSuccess", { name: user.fullName }),
        );
      } else if (mode === "move") {
        setSuccessMessage(t("moveDepartmentSuccess", { name: user.fullName }));
      } else {
        setSuccessMessage(
          t("assignDepartmentSuccess", { name: user.fullName }),
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  });

  async function runConfirmAction() {
    if (!confirmAction || !user) {
      return;
    }
    setActionError(null);
    setSuccessMessage(null);
    try {
      if (confirmAction === "delete") {
        await deleteMutation.mutateAsync();
        setSuccessMessage(t("deleteSuccess", { name: user.fullName }));
        router.push("/employees");
        return;
      }
      if (confirmAction === "reset") {
        await resetMutation.mutateAsync();
        setSuccessMessage(
          t("resetSuccess", {
            name: user.fullName,
            employeeNumber: user.employeeNumber,
          }),
        );
        return;
      }
      if (confirmAction === "deactivate") {
        await patchMutation.mutateAsync({ isActive: false });
        setSuccessMessage(t("deactivateSuccess", { name: user.fullName }));
        return;
      }
      if (confirmAction === "activate") {
        await patchMutation.mutateAsync({ isActive: true });
        setSuccessMessage(t("activateSuccess", { name: user.fullName }));
        return;
      }
      if (confirmAction === "removeDepartment") {
        await membershipMutation.mutateAsync({ mode: "remove" });
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : tCommon("unexpectedError"),
      );
    }
  }

  if (userQuery.isLoading) {
    return <LoadingState />;
  }

  if (userQuery.isError || !user) {
    return (
      <ErrorState
        title={tCommon("errorTitle")}
        description={
          userQuery.error instanceof Error
            ? userQuery.error.message
            : undefined
        }
        onRetry={() => userQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { label: t("title"), href: "/employees" },
            { label: user.fullName },
          ]}
        />
        <PageHeader
          title={user.fullName}
          description={t("profileDescription", {
            employeeNumber: user.employeeNumber,
          })}
          actions={
            <div className="flex flex-wrap gap-2">
              {canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                >
                  {t("edit")}
                </Button>
              ) : null}
              {canManage && !isSelf ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setConfirmAction(user.isActive ? "deactivate" : "activate")
                  }
                >
                  {user.isActive ? t("deactivate") : t("activate")}
                </Button>
              ) : null}
              {!isSelf ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmAction("reset")}
                >
                  {t("resetPassword")}
                </Button>
              ) : null}
              {isAdmin ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedDepartmentId(user.currentDepartment?.id ?? "");
                      setMembershipOpen(true);
                    }}
                  >
                    {user.currentDepartment
                      ? t("moveDepartment")
                      : t("assignDepartment")}
                  </Button>
                  {user.currentDepartment ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmAction("removeDepartment")}
                    >
                      {t("removeDepartment")}
                    </Button>
                  ) : null}
                </>
              ) : null}
              {isAdmin && !isSelf ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmAction("delete")}
                >
                  {t("delete")}
                </Button>
              ) : null}
            </div>
          }
        />
      </div>

      {successMessage ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_28rem] lg:items-start">
        <div className="min-w-0 space-y-4">
          <Tabs
            value={activeTab}
            onValueChange={(id) => setActiveTab(id as ProfileTab)}
            items={[
              {
                id: "projects",
                label: tProjects("title"),
                count: projects.length,
              },
              {
                id: "tasks",
                label: tTasks("title"),
                count: tasks.length,
              },
              {
                id: "attendance",
                label: t("tabAttendance"),
                count: attendanceTotal,
              },
              {
                id: "leave",
                label: t("tabLeave"),
                count: leaveTotal,
              },
              {
                id: "requests",
                label: t("tabRequests"),
                count: requestsTotal,
              },
            ]}
          >
            <TabPanel when="projects" active={activeTab} className="space-y-3">
              {projectsQuery.isLoading ? <LoadingState /> : null}
              {projectsQuery.isError ? (
                <ErrorState
                  title={tCommon("errorTitle")}
                  description={(projectsQuery.error as Error).message}
                  onRetry={() => void projectsQuery.refetch()}
                />
              ) : null}
              {!projectsQuery.isLoading &&
              !projectsQuery.isError &&
              projects.length === 0 ? (
                <EmptyState
                  title={t("emptyProjectsTitle")}
                  description={t("emptyProjectsDescription")}
                />
              ) : null}
              {projects.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tProjects("name")}</TableHead>
                        <TableHead>{tProjects("status")}</TableHead>
                        <TableHead>{tProjects("priority")}</TableHead>
                        <TableHead>{tProjects("endDate")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell>
                            <Link
                              href={`/projects/${project.id}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              {project.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {tProjects(
                                `status_${project.status}` as "status_draft",
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {tProjects(
                              `priority_${project.priority}` as "priority_low",
                            )}
                          </TableCell>
                          <TableCell>{project.endDate ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </TabPanel>

            <TabPanel when="tasks" active={activeTab} className="space-y-3">
              {tasksQuery.isLoading ? <LoadingState /> : null}
              {tasksQuery.isError ? (
                <ErrorState
                  title={tCommon("errorTitle")}
                  description={(tasksQuery.error as Error).message}
                  onRetry={() => void tasksQuery.refetch()}
                />
              ) : null}
              {!tasksQuery.isLoading &&
              !tasksQuery.isError &&
              tasks.length === 0 ? (
                <EmptyState
                  title={t("emptyTasksTitle")}
                  description={t("emptyTasksDescription")}
                />
              ) : null}
              {tasks.length > 0 ? (
                <TasksListTable
                  tasks={tasks}
                  canEdit={canEditTasks}
                  viewerId={currentUserId}
                  showProject
                />
              ) : null}
            </TabPanel>

            <TabPanel when="attendance" active={activeTab} className="space-y-3">
              <EmployeeProfileAttendancePanel
                userId={userId}
                canApprove={canApproveAttendance && !isSelf}
              />
            </TabPanel>

            <TabPanel when="leave" active={activeTab} className="space-y-3">
              <EmployeeProfileLeavePanel
                userId={userId}
                canApprove={canApproveLeave && !isSelf}
              />
            </TabPanel>

            <TabPanel when="requests" active={activeTab} className="space-y-3">
              <EmployeeProfileRequestsPanel
                userId={userId}
                canApprove={canApproveEmployeeRequest && !isSelf}
              />
            </TabPanel>
          </Tabs>
        </div>

        <aside className="min-w-0 space-y-4 rounded-xl bg-muted p-3 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <section className="space-y-1 rounded-lg border border-border/80 bg-card p-3 shadow-sm">
            <h2 className="text-sm font-semibold tracking-tight text-primary">
              {t("properties")}
            </h2>
            <dl>
              <PropertyRow label={t("employeeNumber")}>
                {user.employeeNumber}
              </PropertyRow>
              <PropertyRow label={t("role")}>
                {tRoles(user.role)}
              </PropertyRow>
              <PropertyRow label={t("status")}>
                <Badge variant={user.isActive ? "default" : "secondary"}>
                  {user.isActive ? t("active") : t("inactive")}
                </Badge>
              </PropertyRow>
              <PropertyRow label={t("phone")}>
                {user.phone ?? "—"}
              </PropertyRow>
              <PropertyRow label={t("weeklyCapacityHours")}>
                {user.weeklyCapacityHours}
              </PropertyRow>
              <PropertyRow label={t("department")}>
                {user.currentDepartment?.name ?? t("noDepartment")}
              </PropertyRow>
            </dl>
          </section>
        </aside>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
            <DialogDescription>
              {t("editDescription", { name: user.fullName })}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={editForm.handleSubmit(async (values) => {
              try {
                setSuccessMessage(null);
                const body: Record<string, unknown> = {
                  fullName: values.fullName,
                  phone: values.phone,
                  weeklyCapacityHours: values.weeklyCapacityHours,
                };
                if (isAdmin && !isSelf) {
                  body.role = values.role;
                }
                await patchMutation.mutateAsync(body);
                setSuccessMessage(
                  t("updateSuccess", { name: user.fullName }),
                );
              } catch (error) {
                editForm.setError("root", {
                  message:
                    error instanceof Error ? error.message : t("updateFailed"),
                });
              }
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">{t("fullName")}</Label>
              <Input id="edit-fullName" {...editForm.register("fullName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">{t("phone")}</Label>
              <Input
                id="edit-phone"
                inputMode="numeric"
                maxLength={10}
                {...editForm.register("phone")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-weeklyCapacityHours">
                {t("weeklyCapacityHours")}
              </Label>
              <Input
                id="edit-weeklyCapacityHours"
                type="number"
                inputMode="decimal"
                min={0.5}
                max={80}
                step={0.5}
                {...editForm.register("weeklyCapacityHours", {
                  valueAsNumber: true,
                })}
              />
              <p className="text-xs text-muted-foreground">
                {t("weeklyCapacityHint")}
              </p>
            </div>
            {isAdmin && !isSelf ? (
              <div className="space-y-2">
                <Label htmlFor="edit-role">{t("role")}</Label>
                <select
                  id="edit-role"
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  {...editForm.register("role")}
                >
                  <option value="employee">{tRoles("employee")}</option>
                  <option value="department_manager">
                    {tRoles("department_manager")}
                  </option>
                  <option value="admin">{tRoles("admin")}</option>
                </select>
              </div>
            ) : null}
            {editForm.formState.errors.root ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {editForm.formState.errors.root.message}
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
                {tCommon("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={membershipOpen} onOpenChange={setMembershipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("membershipDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="department">{t("selectDepartment")}</Label>
              <select
                id="department"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={selectedDepartmentId}
                onChange={(event) =>
                  setSelectedDepartmentId(event.target.value)
                }
              >
                <option value="">{t("selectDepartment")}</option>
                {(departmentsQuery.data ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            {actionError ? (
              <Alert variant="destructive">
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMembershipOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="button"
                disabled={
                  !selectedDepartmentId || membershipMutation.isPending
                }
                onClick={async () => {
                  try {
                    setActionError(null);
                    setSuccessMessage(null);
                    await membershipMutation.mutateAsync({
                      departmentId: selectedDepartmentId,
                      mode: user.currentDepartment ? "move" : "assign",
                    });
                  } catch (error) {
                    setActionError(
                      error instanceof Error
                        ? error.message
                        : tCommon("unexpectedError"),
                    );
                  }
                }}
              >
                {tCommon("confirm")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
            setActionError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "delete"
                ? t("confirmDeleteTitle")
                : confirmAction === "reset"
                  ? t("confirmResetTitle")
                  : confirmAction === "deactivate"
                    ? t("confirmDeactivateTitle")
                    : confirmAction === "activate"
                      ? t("confirmActivateTitle")
                      : t("confirmRemoveDepartmentTitle")}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "delete"
                ? t("confirmDeleteDescription", { name: user.fullName })
                : confirmAction === "reset"
                  ? t("confirmResetDescription", { name: user.fullName })
                  : confirmAction === "deactivate"
                    ? t("confirmDeactivateDescription", { name: user.fullName })
                    : confirmAction === "activate"
                      ? t("confirmActivateDescription", { name: user.fullName })
                      : t("confirmRemoveDepartmentDescription", {
                          name: user.fullName,
                        })}
            </DialogDescription>
          </DialogHeader>
          {actionError ? (
            <Alert variant="destructive">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmAction(null)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant={confirmAction === "delete" ? "destructive" : "default"}
              onClick={() => void runConfirmAction()}
            >
              {tCommon("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
