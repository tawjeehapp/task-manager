"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

import {
  createDepartmentSchema,
  type CreateDepartmentInput,
  type DepartmentSortBy,
} from "@/features/departments/schemas/department.schema";
import type { Department } from "@/features/departments/types/department.types";
import type { DepartmentsListResult } from "@/features/departments/services/departments";
import type { Role } from "@/lib/permissions";
import { withInitialData } from "@/lib/query/initial-data";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  type SortDirection,
  type TablePageSize,
} from "@/lib/table/constants";
import { cn } from "@/lib/utils";
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

type DepartmentsPageClientProps = {
  canManage: boolean;
  viewerRole: Role;
  initialDepartments: DepartmentsListResult;
};

type FetchDepartmentsParams = {
  page: number;
  pageSize: TablePageSize;
  status?: string;
  managerId?: string;
  sortBy: DepartmentSortBy;
  sortDir: SortDirection;
};

type BulkAction = "archive" | "delete";

type ManagerOption = {
  id: string;
  fullName: string;
};

async function fetchDepartments(
  params: FetchDepartmentsParams,
): Promise<DepartmentsListResult> {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    sortBy: params.sortBy,
    sortDir: params.sortDir,
  });
  if (params.status) {
    searchParams.set("status", params.status);
  } else {
    searchParams.set("includeArchived", "true");
  }
  if (params.managerId) {
    searchParams.set("managerId", params.managerId);
  }
  const response = await fetch(`/api/departments?${searchParams.toString()}`);
  const payload = (await response.json()) as {
    data?: DepartmentsListResult;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

async function fetchManagers(): Promise<ManagerOption[]> {
  const params = new URLSearchParams({
    role: "department_manager",
    pageSize: "100",
    sortBy: "fullName",
    sortDir: "asc",
  });
  const response = await fetch(`/api/users?${params.toString()}`);
  const payload = (await response.json()) as {
    data?: { items: { id: string; fullName: string }[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return (payload.data?.items ?? []).map((user) => ({
    id: user.id,
    fullName: user.fullName,
  }));
}

export function DepartmentsPageClient({
  canManage,
  viewerRole,
  initialDepartments,
}: DepartmentsPageClientProps) {
  const t = useTranslations("departments");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const [sortBy, setSortBy] = useState<DepartmentSortBy>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [statusFilter, setStatusFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const description =
    viewerRole === "employee"
      ? t("employeeDescription")
      : viewerRole === "department_manager"
        ? t("managerDescription")
        : t("description");

  const isDefaultDepartmentsQuery =
    page === 1 &&
    pageSize === DEFAULT_TABLE_PAGE_SIZE &&
    statusFilter === "" &&
    managerFilter === "" &&
    sortBy === "name" &&
    sortDir === "asc";

  const departmentsQuery = useQuery({
    queryKey: [
      "departments",
      page,
      pageSize,
      statusFilter,
      managerFilter,
      sortBy,
      sortDir,
    ],
    queryFn: () =>
      fetchDepartments({
        page,
        pageSize,
        status: statusFilter || undefined,
        managerId: managerFilter || undefined,
        sortBy,
        sortDir,
      }),
    ...(isDefaultDepartmentsQuery
      ? withInitialData(initialDepartments)
      : {}),
  });

  const managersQuery = useQuery({
    queryKey: ["users", "department_managers"],
    queryFn: fetchManagers,
  });

  const createForm = useForm<CreateDepartmentInput>({
    resolver: zodResolver(createDepartmentSchema) as never,
    defaultValues: { name: "", description: "", managerId: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateDepartmentInput) => {
      const response = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("createFailed"));
      }
    },
    onSuccess: async () => {
      setCreateOpen(false);
      createForm.reset();
      setSuccessMessage(t("createSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  });

  const items = departmentsQuery.data?.items ?? [];
  const total = departmentsQuery.data?.total ?? 0;
  const selectedDepartments = useMemo(
    () => items.filter((department) => selectedIds.has(department.id)),
    [items, selectedIds],
  );
  const allSelected =
    items.length > 0 && items.every((department) => selectedIds.has(department.id));

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column as DepartmentSortBy);
      setSortDir("asc");
    }
    setPage(1);
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(items.map((department) => department.id)));
  }

  async function runBulkAction() {
    if (!bulkAction || selectedDepartments.length === 0) {
      return;
    }

    setBulkRunning(true);
    setActionError(null);
    setSuccessMessage(null);

    const results: { ok: boolean; name: string; message?: string }[] = [];

    try {
      for (const department of selectedDepartments) {
        try {
          if (bulkAction === "archive") {
            if (department.status === "archived") {
              results.push({ ok: true, name: department.name });
              continue;
            }
            const response = await fetch(`/api/departments/${department.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "archived" }),
            });
            const payload = (await response.json()) as {
              error?: { message: string };
            };
            if (!response.ok) {
              throw new Error(payload.error?.message ?? t("updateFailed"));
            }
          } else {
            const response = await fetch(`/api/departments/${department.id}`, {
              method: "DELETE",
            });
            const payload = (await response.json()) as {
              error?: { message: string };
            };
            if (!response.ok) {
              throw new Error(payload.error?.message ?? t("deleteFailed"));
            }
          }
          results.push({ ok: true, name: department.name });
        } catch (error) {
          results.push({
            ok: false,
            name: department.name,
            message:
              error instanceof Error ? error.message : tCommon("unexpectedError"),
          });
        }
      }

      const succeeded = results.filter((result) => result.ok).length;
      const failed = results.filter((result) => !result.ok);
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
      setSelectedIds(new Set());
      setBulkAction(null);

      if (failed.length === 0) {
        setSuccessMessage(
          t("bulkSuccess", {
            action: t(`bulkAction_${bulkAction}`),
            count: succeeded,
          }),
        );
      } else {
        setActionError(
          t("bulkPartialFailure", {
            succeeded,
            failed: failed.length,
            details: failed
              .map((result) => `${result.name}: ${result.message}`)
              .join(" · "),
          }),
        );
      }
    } finally {
      setBulkRunning(false);
    }
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
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={createForm.handleSubmit(async (values) => {
                    try {
                      setSuccessMessage(null);
                      await createMutation.mutateAsync(values);
                    } catch (error) {
                      createForm.setError("root", {
                        message:
                          error instanceof Error
                            ? error.message
                            : t("createFailed"),
                      });
                    }
                  })}
                >
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
                    <Input
                      id="description"
                      {...createForm.register("description")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="managerId">{t("manager")}</Label>
                    <select
                      id="managerId"
                      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      {...createForm.register("managerId")}
                    >
                      <option value="">{t("selectManager")}</option>
                      {(managersQuery.data ?? []).map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.fullName}
                        </option>
                      ))}
                    </select>
                    {createForm.formState.errors.managerId ? (
                      <p className="text-destructive text-sm">
                        {createForm.formState.errors.managerId.message}
                      </p>
                    ) : null}
                  </div>
                  {createForm.formState.errors.root ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {createForm.formState.errors.root.message}
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
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {actionError && !bulkAction ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
              setSelectedIds(new Set());
            }}
            aria-label={t("status")}
          >
            <option value="">{t("filterAllStatuses")}</option>
            <option value="active">{t("active")}</option>
            <option value="archived">{t("archived")}</option>
          </select>
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={managerFilter}
            onChange={(event) => {
              setManagerFilter(event.target.value);
              setPage(1);
              setSelectedIds(new Set());
            }}
            aria-label={t("manager")}
          >
            <option value="">{t("filterAllManagers")}</option>
            <option value="none">{t("noManager")}</option>
            {(managersQuery.data ?? []).map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.fullName}
              </option>
            ))}
          </select>
        </div>
        {departmentsQuery.data ? (
          <p className="text-sm text-muted-foreground">
            {t("totalCount", { count: total })}
          </p>
        ) : null}
      </div>

      {canManage && selectedIds.size > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:flex-row sm:flex-wrap sm:items-center">
          <p className="text-sm font-medium">
            {t("selectedCount", { count: selectedIds.size })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setBulkAction("archive")}
            >
              {t("archive")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => setBulkAction("delete")}
            >
              {t("delete")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              {t("clearSelection")}
            </Button>
          </div>
        </div>
      ) : null}

      {departmentsQuery.isLoading ? <LoadingState /> : null}
      {departmentsQuery.isError ? (
        <ErrorState
          title={tCommon("errorTitle")}
          description={
            departmentsQuery.error instanceof Error
              ? departmentsQuery.error.message
              : undefined
          }
          onRetry={() => departmentsQuery.refetch()}
        />
      ) : null}

      {departmentsQuery.data && total === 0 ? (
        <EmptyState
          title={
            viewerRole === "admin" ? t("emptyTitle") : t("emptyOwnTitle")
          }
          description={
            viewerRole === "admin"
              ? t("emptyDescription")
              : t("emptyOwnDescription")
          }
        />
      ) : null}

      {departmentsQuery.data && items.length > 0 ? (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                {canManage ? (
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label={t("selectAll")}
                    />
                  </TableHead>
                ) : null}
                <SortableTableHead
                  label={t("name")}
                  column="name"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <TableHead>{t("manager")}</TableHead>
                <SortableTableHead
                  label={t("members")}
                  column="memberCount"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={t("activeProjects")}
                  column="activeProjectCount"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={t("status")}
                  column="status"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((department) => {
                const checked = selectedIds.has(department.id);
                return (
                  <TableRow
                    key={department.id}
                    className={cn(
                      "cursor-pointer",
                      checked && "bg-muted/40",
                    )}
                    onClick={() =>
                      router.push(`/departments/${department.id}`)
                    }
                  >
                    {canManage ? (
                      <TableCell
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={checked}
                          onChange={() => toggleSelect(department.id)}
                          aria-label={t("selectDepartment", {
                            name: department.name,
                          })}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell className="font-medium">
                      {department.name}
                    </TableCell>
                    <TableCell>
                      {department.manager?.fullName ?? t("noManager")}
                    </TableCell>
                    <TableCell>
                      {t("memberCount", { count: department.memberCount })}
                    </TableCell>
                    <TableCell>
                      {t("activeProjectCount", {
                        count: department.activeProjectCount,
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          department.status === "active"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {department.status === "active"
                          ? t("active")
                          : t("archived")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
          />
        </div>
      ) : null}

      <Dialog
        open={Boolean(bulkAction)}
        onOpenChange={(open) => {
          if (!open) {
            setBulkAction(null);
            setActionError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction ? t(`bulkConfirmTitle_${bulkAction}`) : ""}
            </DialogTitle>
            <DialogDescription>
              {bulkAction
                ? t(`bulkConfirmDescription_${bulkAction}`, {
                    count: selectedDepartments.length,
                  })
                : ""}
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
              onClick={() => setBulkAction(null)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant={bulkAction === "delete" ? "destructive" : "default"}
              disabled={bulkRunning}
              onClick={() => {
                void runBulkAction();
              }}
            >
              {bulkRunning ? tCommon("saving") : tCommon("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
