"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

import { EntityActivityPanel } from "@/features/activity/components/entity-activity-panel";
import {
  updateDepartmentSchema,
  type UpdateDepartmentInput,
} from "@/features/departments/schemas/department.schema";
import type {
  Department,
  DepartmentMembership,
} from "@/features/departments/types/department.types";
import type { Project } from "@/features/projects/types/project.types";
import type { UsersListResult } from "@/features/users/types/user.types";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { TabPanel, Tabs } from "@/components/shared/tabs";
import { TablePagination } from "@/components/shared/table-pagination";
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
import {
  DEFAULT_TABLE_PAGE_SIZE,
  type TablePageSize,
} from "@/lib/table/constants";

type DepartmentDetailClientProps = {
  departmentId: string;
  canManage: boolean;
  canViewEmployeeProfiles?: boolean;
};

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

async function fetchDepartment(id: string): Promise<Department> {
  const response = await fetch(`/api/departments/${id}`);
  const payload = (await response.json()) as {
    data?: Department;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

async function fetchMembers(
  id: string,
  includeHistory: boolean,
): Promise<DepartmentMembership[]> {
  const params = new URLSearchParams();
  if (includeHistory) {
    params.set("includeHistory", "true");
  }
  const response = await fetch(
    `/api/departments/${id}/members?${params.toString()}`,
  );
  const payload = (await response.json()) as {
    data?: { items: DepartmentMembership[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!.items;
}

async function fetchUsers(): Promise<UsersListResult> {
  const response = await fetch("/api/users?pageSize=100");
  const payload = (await response.json()) as {
    data?: UsersListResult;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

async function fetchDepartmentProjects(
  departmentId: string,
): Promise<Project[]> {
  const params = new URLSearchParams({
    departmentId,
    pageSize: "100",
    includeArchived: "true",
    sortBy: "name",
    sortDir: "asc",
  });
  const response = await fetch(`/api/projects?${params.toString()}`);
  const payload = (await response.json()) as {
    data?: { items: Project[] };
    error?: { message: string };
  };
  if (!response.ok) {
    // Viewers without project.view still see department; show empty projects.
    if (response.status === 403) {
      return [];
    }
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!.items;
}

export function DepartmentDetailClient({
  departmentId,
  canManage,
  canViewEmployeeProfiles = false,
}: DepartmentDetailClientProps) {
  const t = useTranslations("departments");
  const tProjects = useTranslations("projects");
  const tRoles = useTranslations("roles");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const [removeMember, setRemoveMember] = useState<DepartmentMembership | null>(
    null,
  );
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [membersPage, setMembersPage] = useState(1);
  const [membersPageSize, setMembersPageSize] =
    useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const [activeTab, setActiveTab] = useState<"projects" | "members">("projects");

  const departmentQuery = useQuery({
    queryKey: ["departments", departmentId],
    queryFn: () => fetchDepartment(departmentId),
  });

  const membersQuery = useQuery({
    queryKey: ["departments", departmentId, "members", canManage],
    queryFn: () => fetchMembers(departmentId, canManage),
  });

  const projectsQuery = useQuery({
    queryKey: ["projects", { departmentId }],
    queryFn: () => fetchDepartmentProjects(departmentId),
  });

  const currentMembers = useMemo(
    () => (membersQuery.data ?? []).filter((m) => m.isCurrent),
    [membersQuery.data],
  );
  const pagedCurrentMembers = useMemo(() => {
    const from = (membersPage - 1) * membersPageSize;
    return currentMembers.slice(from, from + membersPageSize);
  }, [currentMembers, membersPage, membersPageSize]);

  const usersQuery = useQuery({
    queryKey: ["users", "for-department"],
    queryFn: fetchUsers,
    enabled: canManage && (managerOpen || addMemberOpen),
  });

  const editForm = useForm<UpdateDepartmentInput>({
    resolver: zodResolver(updateDepartmentSchema) as never,
    values: {
      name: departmentQuery.data?.name ?? "",
      description: departmentQuery.data?.description ?? "",
    },
  });

  const patchMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await fetch(`/api/departments/${departmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        error?: { message: string; code?: string };
      };
      if (!response.ok) {
        const err = new Error(payload.error?.message ?? t("updateFailed")) as Error & {
          code?: string;
        };
        err.code = payload.error?.code;
        throw err;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
      await queryClient.invalidateQueries({
        queryKey: ["department", departmentId, "activity"],
      });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/departments/${departmentId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("updateFailed"));
      }
    },
    onSuccess: async () => {
      setAddMemberOpen(false);
      setSelectedMemberId("");
      setSuccessMessage(t("addMemberSuccess"));
      await queryClient.invalidateQueries({
        queryKey: ["departments", departmentId],
      });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({
        queryKey: ["department", departmentId, "activity"],
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(
        `/api/departments/${departmentId}/members/${userId}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("updateFailed"));
      }
    },
    onSuccess: async () => {
      setRemoveMember(null);
      setSuccessMessage(t("removeMemberSuccess"));
      await queryClient.invalidateQueries({
        queryKey: ["departments", departmentId],
      });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({
        queryKey: ["department", departmentId, "activity"],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/departments/${departmentId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("deleteFailed"));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
      router.push("/departments");
    },
  });

  const department = departmentQuery.data;
  const managerCandidates =
    usersQuery.data?.items.filter(
      (user) => user.role === "department_manager" && user.isActive,
    ) ?? [];

  // Users with no current department
  const availableMembers =
    usersQuery.data?.items.filter(
      (user) => user.isActive && !user.currentDepartment,
    ) ?? [];

  if (departmentQuery.isLoading) {
    return <LoadingState />;
  }

  if (departmentQuery.isError || !department) {
    return (
      <ErrorState
        title={tCommon("errorTitle")}
        description={
          departmentQuery.error instanceof Error
            ? departmentQuery.error.message
            : undefined
        }
        onRetry={() => departmentQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { label: t("title"), href: "/departments" },
            { label: department.name },
          ]}
        />
        <PageHeader
          title={department.name}
          description={department.description ?? undefined}
          actions={
            canManage ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                >
                  {t("edit")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedManagerId(department.managerId ?? "");
                    setManagerOpen(true);
                  }}
                >
                  {department.managerId
                    ? t("replaceManager")
                    : t("assignManager")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setArchiveConfirmOpen(true)}
                >
                  {department.status === "archived"
                    ? t("unarchive")
                    : t("archive")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  {t("delete")}
                </Button>
              </div>
            ) : null
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
            onValueChange={(id) => setActiveTab(id as "projects" | "members")}
            items={[
              {
                id: "projects",
                label: tProjects("title"),
                count: projectsQuery.data?.length,
              },
              {
                id: "members",
                label: t("members"),
                count: currentMembers.length,
              },
            ]}
            actions={
              activeTab === "members" && canManage ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setAddMemberOpen(true)}
                  disabled={department.status === "archived"}
                >
                  {t("addMember")}
                </Button>
              ) : null
            }
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
              (projectsQuery.data?.length ?? 0) === 0 ? (
                <EmptyState
                  title={tProjects("emptyTitle")}
                  description={tProjects("emptyDescription")}
                />
              ) : null}
              {(projectsQuery.data?.length ?? 0) > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tProjects("name")}</TableHead>
                        <TableHead>{tProjects("status")}</TableHead>
                        <TableHead>{tProjects("priority")}</TableHead>
                        <TableHead>{tProjects("members")}</TableHead>
                        <TableHead>{tProjects("endDate")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(projectsQuery.data ?? []).map((project) => (
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
                          <TableCell>
                            {tProjects("memberCount", {
                              count: project.memberCount,
                            })}
                          </TableCell>
                          <TableCell>{project.endDate ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </TabPanel>

            <TabPanel when="members" active={activeTab} className="space-y-3">
              {membersQuery.isLoading ? <LoadingState /> : null}
              {!membersQuery.isLoading && currentMembers.length === 0 ? (
                <EmptyState title={t("members")} description="—" />
              ) : null}
              {currentMembers.length > 0 ? (
                <div className="rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("personName")}</TableHead>
                        <TableHead>{t("role")}</TableHead>
                        <TableHead>{t("startDate")}</TableHead>
                        {canManage ? (
                          <TableHead className="text-start">
                            {t("actions")}
                          </TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedCurrentMembers.map((membership) => (
                        <TableRow key={membership.id}>
                          <TableCell>
                            {canViewEmployeeProfiles && membership.userId ? (
                              <Link
                                href={`/employees/${membership.userId}`}
                                className="font-medium underline-offset-4 hover:underline"
                              >
                                {membership.user?.fullName ?? membership.userId}
                              </Link>
                            ) : (
                              (membership.user?.fullName ?? membership.userId)
                            )}
                          </TableCell>
                          <TableCell>
                            {membership.user
                              ? tRoles(membership.user.role)
                              : "—"}
                          </TableCell>
                          <TableCell>{membership.startDate}</TableCell>
                          {canManage ? (
                            <TableCell>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setRemoveMember(membership)}
                              >
                                {t("removeMember")}
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    page={membersPage}
                    pageSize={membersPageSize}
                    total={currentMembers.length}
                    onPageChange={setMembersPage}
                    onPageSizeChange={(size) => {
                      setMembersPageSize(size);
                      setMembersPage(1);
                    }}
                  />
                </div>
              ) : null}
            </TabPanel>
          </Tabs>
        </div>

        <aside className="min-w-0 space-y-4 rounded-xl bg-muted p-3 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <section className="space-y-1 rounded-lg border border-border/80 bg-card p-3 shadow-sm">
            <h2 className="text-sm font-semibold tracking-tight text-primary">
              {t("properties")}
            </h2>
            <dl>
              <PropertyRow label={t("status")}>
                <Badge
                  variant={
                    department.status === "active" ? "default" : "secondary"
                  }
                >
                  {department.status === "active" ? t("active") : t("archived")}
                </Badge>
              </PropertyRow>
              <PropertyRow label={t("manager")}>
                {department.manager?.fullName ?? t("noManager")}
              </PropertyRow>
              <PropertyRow label={t("members")}>
                {t("memberCount", { count: department.memberCount })}
              </PropertyRow>
              <PropertyRow label={t("activeProjects")}>
                {department.activeProjectCount}
              </PropertyRow>
            </dl>
            {department.description ? (
              <p className="text-muted-foreground mt-3 border-t border-border/70 pt-3 text-xs whitespace-pre-wrap">
                {department.description}
              </p>
            ) : null}
          </section>

          <section className="space-y-3 rounded-lg border border-border/80 bg-card p-3 shadow-sm">
            <h2 className="text-sm font-semibold tracking-tight text-primary">
              {t("activity")}
            </h2>
            <EntityActivityPanel
              entityType="department"
              entityId={departmentId}
              messagesNamespace="departments"
            />
          </section>

          {canManage ? (
            <section className="space-y-3 rounded-lg border border-border/80 bg-card p-3 shadow-sm">
              <h2 className="text-sm font-semibold tracking-tight text-primary">
                {t("history")}
              </h2>
              {membersQuery.isLoading ? <LoadingState /> : null}
              {!membersQuery.isLoading &&
              !(membersQuery.data ?? []).some((m) => !m.isCurrent) ? (
                <EmptyState title={t("history")} description="—" />
              ) : null}
              {(membersQuery.data ?? []).some((m) => !m.isCurrent) ? (
                <ul className="divide-border divide-y rounded-lg border">
                  {(membersQuery.data ?? [])
                    .filter((m) => !m.isCurrent)
                    .map((membership) => (
                      <li key={membership.id} className="space-y-1 px-3 py-2.5">
                        <p className="text-sm font-medium">
                          {canViewEmployeeProfiles && membership.userId ? (
                            <Link
                              href={`/employees/${membership.userId}`}
                              className="underline-offset-4 hover:underline"
                            >
                              {membership.user?.fullName ?? membership.userId}
                            </Link>
                          ) : (
                            (membership.user?.fullName ?? membership.userId)
                          )}
                        </p>
                        <p className="text-muted-foreground text-xs tabular-nums">
                          {membership.startDate}
                          {" → "}
                          {membership.endDate ?? "—"}
                        </p>
                      </li>
                    ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={editForm.handleSubmit(async (values) => {
              try {
                setSuccessMessage(null);
                await patchMutation.mutateAsync({
                  name: values.name,
                  description: values.description,
                });
                setEditOpen(false);
                setSuccessMessage(t("updateSuccess"));
              } catch (error) {
                editForm.setError("root", {
                  message:
                    error instanceof Error ? error.message : t("updateFailed"),
                });
              }
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t("name")}</Label>
              <Input id="edit-name" {...editForm.register("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{t("descriptionLabel")}</Label>
              <Input
                id="edit-description"
                {...editForm.register("description")}
              />
            </div>
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

      {/* Assign manager */}
      <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {department.managerId
                ? t("replaceManager")
                : t("assignManager")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manager">{t("selectManager")}</Label>
              <select
                id="manager"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={selectedManagerId}
                onChange={(event) => setSelectedManagerId(event.target.value)}
              >
                <option value="">{t("selectManager")}</option>
                {managerCandidates.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName} ({user.employeeNumber})
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
                onClick={() => setManagerOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="button"
                disabled={!selectedManagerId || patchMutation.isPending}
                onClick={async () => {
                  try {
                    setActionError(null);
                    setSuccessMessage(null);
                    await patchMutation.mutateAsync({
                      managerId: selectedManagerId,
                      replaceExistingManager: Boolean(department.managerId),
                    });
                    setManagerOpen(false);
                    setSuccessMessage(t("assignManagerSuccess"));
                  } catch (error) {
                    const code =
                      error instanceof Error &&
                      "code" in error &&
                      typeof (error as { code?: string }).code === "string"
                        ? (error as { code: string }).code
                        : undefined;
                    if (code === "MANAGER_ALREADY_ASSIGNED") {
                      setReplaceConfirm(true);
                      return;
                    }
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

      <Dialog open={replaceConfirm} onOpenChange={setReplaceConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmReplaceManagerTitle")}</DialogTitle>
            <DialogDescription>
              {t("confirmReplaceManagerDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReplaceConfirm(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              onClick={async () => {
                try {
                  await patchMutation.mutateAsync({
                    managerId: selectedManagerId,
                    replaceExistingManager: true,
                  });
                  setReplaceConfirm(false);
                  setManagerOpen(false);
                  setSuccessMessage(t("assignManagerSuccess"));
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
        </DialogContent>
      </Dialog>

      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addMember")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member">{t("selectMember")}</Label>
              <select
                id="member"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={selectedMemberId}
                onChange={(event) => setSelectedMemberId(event.target.value)}
              >
                <option value="">{t("selectMember")}</option>
                {availableMembers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName} ({user.employeeNumber})
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
                onClick={() => setAddMemberOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="button"
                disabled={!selectedMemberId || addMemberMutation.isPending}
                onClick={async () => {
                  try {
                    setActionError(null);
                    await addMemberMutation.mutateAsync(selectedMemberId);
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
              onClick={async () => {
                if (!removeMember) {
                  return;
                }
                try {
                  await removeMemberMutation.mutateAsync(removeMember.userId);
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
        </DialogContent>
      </Dialog>

      <Dialog
        open={archiveConfirmOpen}
        onOpenChange={(open) => {
          setArchiveConfirmOpen(open);
          if (!open) {
            setActionError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {department.status === "archived"
                ? t("unarchive")
                : t("confirmArchiveTitle")}
            </DialogTitle>
            <DialogDescription>
              {department.status === "archived"
                ? department.name
                : t("confirmArchiveDescription", { name: department.name })}
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
              onClick={() => setArchiveConfirmOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={patchMutation.isPending}
              onClick={async () => {
                try {
                  setActionError(null);
                  const nextStatus =
                    department.status === "archived" ? "active" : "archived";
                  await patchMutation.mutateAsync({ status: nextStatus });
                  setArchiveConfirmOpen(false);
                  setSuccessMessage(
                    nextStatus === "archived"
                      ? t("archiveSuccess")
                      : t("unarchiveSuccess"),
                  );
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
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open);
          if (!open) {
            setActionError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("confirmDeleteDescription", { name: department.name })}
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
              onClick={() => setDeleteConfirmOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={async () => {
                try {
                  setActionError(null);
                  await deleteMutation.mutateAsync();
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
