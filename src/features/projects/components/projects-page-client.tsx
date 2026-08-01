"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { ExternalLink, Plus } from "lucide-react";

import {
  createProjectSchema,
  type CreateProjectInput,
  type ProjectSortBy,
} from "@/features/projects/schemas/project.schema";
import type { Project } from "@/features/projects/types/project.types";
import type { ProjectsListResult } from "@/features/projects/services/projects";
import type { Department } from "@/features/departments/types/department.types";
import type { Role } from "@/lib/permissions";
import { withInitialData } from "@/lib/query/initial-data";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  type SortDirection,
  type TablePageSize,
} from "@/lib/table/constants";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { SortableTableHead } from "@/components/shared/sortable-table-head";
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
  DialogTrigger,
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

type ProjectsPageClientProps = {
  canManage: boolean;
  viewerRole: Role;
  initialProjects: ProjectsListResult;
};

type FetchProjectsParams = {
  page: number;
  pageSize: TablePageSize;
  includeArchived: boolean;
  status?: string;
  sortBy: ProjectSortBy;
  sortDir: SortDirection;
};

async function fetchProjects(
  params: FetchProjectsParams,
): Promise<ProjectsListResult> {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    sortBy: params.sortBy,
    sortDir: params.sortDir,
  });
  if (params.includeArchived) {
    searchParams.set("includeArchived", "true");
  }
  if (params.status) {
    searchParams.set("status", params.status);
  }
  const response = await fetch(`/api/projects?${searchParams.toString()}`);
  const payload = (await response.json()) as {
    data?: ProjectsListResult;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

async function fetchDepartments(): Promise<Department[]> {
  const response = await fetch("/api/departments?pageSize=100");
  const payload = (await response.json()) as {
    data?: { items: Department[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!.items;
}

export function ProjectsPageClient({
  canManage,
  viewerRole,
  initialProjects,
}: ProjectsPageClientProps) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const [sortBy, setSortBy] = useState<ProjectSortBy>("createdAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const description =
    viewerRole === "employee"
      ? t("employeeDescription")
      : viewerRole === "department_manager"
        ? t("managerDescription")
        : viewerRole === "admin"
          ? t("adminDescription")
          : t("description");

  const isDefaultProjectsQuery =
    page === 1 &&
    pageSize === DEFAULT_TABLE_PAGE_SIZE &&
    !includeArchived &&
    statusFilter === "" &&
    sortBy === "createdAt" &&
    sortDir === "desc";

  const projectsQuery = useQuery({
    queryKey: [
      "projects",
      page,
      pageSize,
      includeArchived,
      statusFilter,
      sortBy,
      sortDir,
    ],
    queryFn: () =>
      fetchProjects({
        page,
        pageSize,
        includeArchived,
        status: statusFilter || undefined,
        sortBy,
        sortDir,
      }),
    ...(isDefaultProjectsQuery ? withInitialData(initialProjects) : {}),
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments", "for-project-create"],
    queryFn: fetchDepartments,
    enabled: canManage,
  });

  const createForm = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema) as never,
    defaultValues: {
      departmentId: "",
      name: "",
      description: "",
      status: "draft",
      priority: "medium",
      startDate: null,
      endDate: "",
      memberIds: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateProjectInput) => {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as {
        data?: Project;
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("createFailed"));
      }
      return payload.data!;
    },
    onSuccess: async (project) => {
      setCreateOpen(false);
      createForm.reset({
        departmentId: "",
        name: "",
        description: "",
        status: "draft",
        priority: "medium",
        startDate: null,
        endDate: "",
        memberIds: [],
      });
      setSuccessMessage(t("createSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      router.push(`/projects/${project.id}`);
    },
  });

  const patchMutation = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: Record<string, unknown>;
    }) => {
      const response = await fetch(`/api/projects/${id}`, {
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
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const items = projectsQuery.data?.items ?? [];
  const total = projectsQuery.data?.total ?? 0;

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column as ProjectSortBy);
      setSortDir("asc");
    }
    setPage(1);
  }

  function statusLabel(status: string) {
    return t(`status_${status}` as "status_draft");
  }

  function priorityLabel(priority: string) {
    return t(`priority_${priority}` as "priority_low");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={description}
        actions={
          canManage ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger
                render={<Button type="button" className="gap-2" />}
              >
                <Plus className="size-4" />
                {t("create")}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("createTitle")}</DialogTitle>
                  <DialogDescription>{t("createDescription")}</DialogDescription>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={createForm.handleSubmit((values) =>
                    createMutation.mutate({ ...values, startDate: null }),
                  )}
                >
                  {canManage ? (
                    <div className="space-y-2">
                      <Label htmlFor="departmentId">{t("department")}</Label>
                      <select
                        id="departmentId"
                        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                        {...createForm.register("departmentId")}
                      >
                        <option value="">{t("selectDepartment")}</option>
                        {(departmentsQuery.data ?? [])
                          .filter(
                            (d) => d.status === "active" && Boolean(d.managerId),
                          )
                          .map((department) => (
                            <option key={department.id} value={department.id}>
                              {department.name}
                            </option>
                          ))}
                      </select>
                      {createForm.formState.errors.departmentId ? (
                        <p className="text-destructive text-sm">
                          {createForm.formState.errors.departmentId.message}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("name")}</Label>
                    <Input id="name" {...createForm.register("name")} />
                    {createForm.formState.errors.name ? (
                      <p className="text-destructive text-sm">
                        {createForm.formState.errors.name.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">{t("descriptionLabel")}</Label>
                    <textarea
                      id="description"
                      className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                      {...createForm.register("description")}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="priority">{t("priority")}</Label>
                      <select
                        id="priority"
                        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                        {...createForm.register("priority")}
                      >
                        <option value="low">{priorityLabel("low")}</option>
                        <option value="medium">{priorityLabel("medium")}</option>
                        <option value="high">{priorityLabel("high")}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">{t("status")}</Label>
                      <select
                        id="status"
                        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                        {...createForm.register("status")}
                      >
                        <option value="draft">{statusLabel("draft")}</option>
                        <option value="active">{statusLabel("active")}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">{t("endDate")}</Label>
                      <Input
                        id="endDate"
                        type="date"
                        required
                        {...createForm.register("endDate")}
                      />
                      {createForm.formState.errors.endDate ? (
                        <p className="text-destructive text-xs">
                          {createForm.formState.errors.endDate.message}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {t("endDateRequiredHint")}
                        </p>
                      )}
                    </div>
                  </div>
                  {createMutation.isError ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {(createMutation.error as Error).message}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreateOpen(false)}
                    >
                      {tCommon("cancel")}
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending
                        ? tCommon("saving")
                        : tCommon("save")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {successMessage ? (
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => {
              setIncludeArchived(event.target.checked);
              setPage(1);
            }}
          />
          {t("includeArchived")}
        </label>
        <select
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("filterAllStatuses")}</option>
          <option value="draft">{statusLabel("draft")}</option>
          <option value="active">{statusLabel("active")}</option>
          <option value="completed">{statusLabel("completed")}</option>
          <option value="archived">{statusLabel("archived")}</option>
        </select>
      </div>

      {projectsQuery.isLoading ? <LoadingState /> : null}
      {projectsQuery.isError ? (
        <ErrorState
          title={tCommon("errorTitle")}
          description={(projectsQuery.error as Error).message}
          onRetry={() => void projectsQuery.refetch()}
        />
      ) : null}

      {projectsQuery.isSuccess && items.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : null}

      {projectsQuery.isSuccess && items.length > 0 ? (
        <>
          <p className="text-muted-foreground text-sm">
            {t("totalCount", { count: total })}
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    column="name"
                    label={t("name")}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <TableHead>{t("department")}</TableHead>
                  <SortableTableHead
                    column="status"
                    label={t("status")}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    column="priority"
                    label={t("priority")}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <TableHead>{t("members")}</TableHead>
                  <SortableTableHead
                    column="endDate"
                    label={t("endDate")}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <TableHead className="w-12">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((project) => (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <TableCell className="font-medium">
                      <Link
                        href={`/projects/${project.id}`}
                        className="underline-offset-4 hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell>{project.department?.name ?? "—"}</TableCell>
                    <TableCell
                      onClick={(event) => event.stopPropagation()}
                    >
                      {canManage ? (
                        <select
                          className="border-input bg-background h-8 rounded-md border px-2 text-sm"
                          value={project.status}
                          disabled={patchMutation.isPending}
                          onChange={(event) =>
                            patchMutation.mutate({
                              id: project.id,
                              body: { status: event.target.value },
                            })
                          }
                          aria-label={t("status")}
                        >
                          {(
                            [
                              "draft",
                              "active",
                              "completed",
                              "archived",
                            ] as const
                          ).map((status) => (
                            <option key={status} value={status}>
                              {statusLabel(status)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge variant="secondary">
                          {statusLabel(project.status)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell
                      onClick={(event) => event.stopPropagation()}
                    >
                      {canManage ? (
                        <select
                          className="border-input bg-background h-8 rounded-md border px-2 text-sm"
                          value={project.priority}
                          disabled={patchMutation.isPending}
                          onChange={(event) =>
                            patchMutation.mutate({
                              id: project.id,
                              body: { priority: event.target.value },
                            })
                          }
                          aria-label={t("priority")}
                        >
                          {(["low", "medium", "high"] as const).map(
                            (priority) => (
                              <option key={priority} value={priority}>
                                {priorityLabel(priority)}
                              </option>
                            ),
                          )}
                        </select>
                      ) : (
                        priorityLabel(project.priority)
                      )}
                    </TableCell>
                    <TableCell>
                      {t("memberCount", { count: project.memberCount })}
                    </TableCell>
                    <TableCell
                      onClick={(event) => event.stopPropagation()}
                    >
                      {canManage ? (
                        <Input
                          type="date"
                          className="h-8 w-[9.5rem]"
                          defaultValue={project.endDate}
                          disabled={patchMutation.isPending}
                          required
                          aria-label={t("endDate")}
                          onBlur={(event) => {
                            const next = event.target.value;
                            if (!next || next === project.endDate) {
                              if (!next) {
                                event.target.value = project.endDate;
                              }
                              return;
                            }
                            patchMutation.mutate({
                              id: project.id,
                              body: { endDate: next },
                            });
                          }}
                        />
                      ) : (
                        project.endDate
                      )}
                    </TableCell>
                    <TableCell
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Link
                        href={`/projects/${project.id}`}
                        className="hover:bg-muted inline-flex size-7 items-center justify-center rounded-[min(var(--radius-md),12px)]"
                        aria-label={t("openDetails")}
                        title={t("openDetails")}
                      >
                        <ExternalLink className="size-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
