"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

import {
  createUserSchema,
  type CreateUserInput,
} from "@/features/users/schemas/user.schema";
import type { Department } from "@/features/departments/types/department.types";
import type { UsersListResult } from "@/features/users/types/user.types";
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
import { withInitialData } from "@/lib/query/initial-data";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  type SortDirection,
  type TablePageSize,
} from "@/lib/table/constants";
import { cn } from "@/lib/utils";

type EmployeesPageClientProps = {
  canManage: boolean;
  currentUserId: string;
  initialUsers: UsersListResult;
};

type BulkAction =
  | "activate"
  | "deactivate"
  | "reset"
  | "delete"
  | "assignDepartment";

type RoleFilter = "" | "admin" | "department_manager" | "employee";
type StatusFilter = "" | "active" | "inactive";
type SortByColumn =
  | "fullName"
  | "employeeNumber"
  | "role"
  | "status"
  | "createdAt";

type UsersFetchParams = {
  page: number;
  pageSize: TablePageSize;
  search: string;
  role: RoleFilter;
  status: StatusFilter;
  departmentId: string;
  sortBy: SortByColumn;
  sortDir: SortDirection;
};

async function fetchUsers(params: UsersFetchParams): Promise<UsersListResult> {
  const query = new URLSearchParams();
  query.set("page", String(params.page));
  query.set("pageSize", String(params.pageSize));
  if (params.search) {
    query.set("search", params.search);
  }
  if (params.role) {
    query.set("role", params.role);
  }
  if (params.status === "active") {
    query.set("isActive", "true");
  } else if (params.status === "inactive") {
    query.set("isActive", "false");
  }
  if (params.departmentId) {
    query.set("departmentId", params.departmentId);
  }
  query.set("sortBy", params.sortBy);
  query.set("sortDir", params.sortDir);

  const response = await fetch(`/api/users?${query.toString()}`);
  const payload = (await response.json()) as {
    data?: UsersListResult;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed to load users");
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

export function EmployeesPageClient({
  canManage,
  currentUserId,
  initialUsers,
}: EmployeesPageClientProps) {
  const t = useTranslations("employees");
  const tRoles = useTranslations("roles");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(
    DEFAULT_TABLE_PAGE_SIZE,
  );
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [sortBy, setSortBy] = useState<SortByColumn>("createdAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkDepartmentId, setBulkDepartmentId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);

  const isDefaultUsersQuery =
    page === 1 &&
    pageSize === DEFAULT_TABLE_PAGE_SIZE &&
    search === "" &&
    roleFilter === "" &&
    departmentFilter === "" &&
    statusFilter === "" &&
    sortBy === "createdAt" &&
    sortDir === "desc";

  const usersQuery = useQuery({
    queryKey: [
      "users",
      page,
      pageSize,
      search,
      roleFilter,
      departmentFilter,
      statusFilter,
      sortBy,
      sortDir,
    ],
    queryFn: () =>
      fetchUsers({
        page,
        pageSize,
        search,
        role: roleFilter,
        status: statusFilter,
        departmentId: departmentFilter,
        sortBy,
        sortDir,
      }),
    ...(isDefaultUsersQuery ? withInitialData(initialUsers) : {}),
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments", "filter"],
    queryFn: fetchDepartments,
    enabled: canManage,
  });

  const items = usersQuery.data?.items ?? [];
  const total = usersQuery.data?.total ?? 0;
  const selectableItems = useMemo(
    () => items.filter((user) => user.id !== currentUserId),
    [items, currentUserId],
  );

  const allSelectableSelected =
    selectableItems.length > 0 &&
    selectableItems.every((user) => selectedIds.has(user.id));

  const selectedUsers = useMemo(
    () => items.filter((user) => selectedIds.has(user.id)),
    [items, selectedIds],
  );

  const createForm = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema) as never,
    defaultValues: {
      employeeNumber: "",
      fullName: "",
      phone: "",
      role: "employee",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateUserInput) => {
      const response = await fetch("/api/users", {
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
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  function resetToFirstPage() {
    setPage(1);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    resetToFirstPage();
  }

  function handlePageSizeChange(nextSize: TablePageSize) {
    setPageSize(nextSize);
    resetToFirstPage();
  }

  function handleRoleFilterChange(value: RoleFilter) {
    setRoleFilter(value);
    resetToFirstPage();
  }

  function handleDepartmentFilterChange(value: string) {
    setDepartmentFilter(value);
    resetToFirstPage();
  }

  function handleStatusFilterChange(value: StatusFilter) {
    setStatusFilter(value);
    resetToFirstPage();
  }

  function handleSort(column: string) {
    const nextColumn = column as SortByColumn;
    if (sortBy === nextColumn) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(nextColumn);
      setSortDir("asc");
    }
    resetToFirstPage();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelectableSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(selectableItems.map((user) => user.id)));
  }

  async function runBulkAction() {
    if (!bulkAction || selectedUsers.length === 0) {
      return;
    }

    setBulkRunning(true);
    setActionError(null);
    setSuccessMessage(null);

    const results: { ok: boolean; name: string; message?: string }[] = [];

    try {
      for (const user of selectedUsers) {
        try {
          if (bulkAction === "activate" || bulkAction === "deactivate") {
            const response = await fetch(`/api/users/${user.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                isActive: bulkAction === "activate",
              }),
            });
            const payload = (await response.json()) as {
              error?: { message: string };
            };
            if (!response.ok) {
              throw new Error(payload.error?.message ?? t("updateFailed"));
            }
          } else if (bulkAction === "reset") {
            const response = await fetch(
              `/api/users/${user.id}/reset-password`,
              { method: "POST" },
            );
            const payload = (await response.json()) as {
              error?: { message: string };
            };
            if (!response.ok) {
              throw new Error(payload.error?.message ?? t("resetFailed"));
            }
          } else if (bulkAction === "delete") {
            const response = await fetch(`/api/users/${user.id}`, {
              method: "DELETE",
            });
            const payload = (await response.json()) as {
              error?: { message: string };
            };
            if (!response.ok) {
              throw new Error(payload.error?.message ?? t("deleteFailed"));
            }
          } else if (bulkAction === "assignDepartment") {
            if (!bulkDepartmentId) {
              throw new Error(t("selectDepartment"));
            }
            if (user.currentDepartment?.id === bulkDepartmentId) {
              results.push({ ok: true, name: user.fullName });
              continue;
            }
            if (user.currentDepartment) {
              const response = await fetch("/api/departments/members/move", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: user.id,
                  toDepartmentId: bulkDepartmentId,
                }),
              });
              const payload = (await response.json()) as {
                error?: { message: string };
              };
              if (!response.ok) {
                throw new Error(
                  payload.error?.message ?? t("membershipFailed"),
                );
              }
            } else {
              const response = await fetch(
                `/api/departments/${bulkDepartmentId}/members`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: user.id }),
                },
              );
              const payload = (await response.json()) as {
                error?: { message: string };
              };
              if (!response.ok) {
                throw new Error(
                  payload.error?.message ?? t("membershipFailed"),
                );
              }
            }
          }
          results.push({ ok: true, name: user.fullName });
        } catch (error) {
          results.push({
            ok: false,
            name: user.fullName,
            message:
              error instanceof Error
                ? error.message
                : tCommon("unexpectedError"),
          });
        }
      }

      const failed = results.filter((result) => !result.ok);
      const succeeded = results.filter((result) => result.ok).length;

      if (failed.length === 0) {
        setSuccessMessage(
          t("bulkSuccess", {
            count: succeeded,
            action: t(`bulkAction_${bulkAction}`),
          }),
        );
      } else {
        setActionError(
          t("bulkPartialFailure", {
            succeeded,
            failed: failed.length,
            details: failed
              .map((item) => `${item.name}: ${item.message}`)
              .join(" · "),
          }),
        );
        if (succeeded > 0) {
          setSuccessMessage(
            t("bulkSuccess", {
              count: succeeded,
              action: t(`bulkAction_${bulkAction}`),
            }),
          );
        }
      }

      setBulkAction(null);
      setBulkDepartmentId("");
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
    } finally {
      setBulkRunning(false);
    }
  }

  const selectClassName =
    "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={canManage ? t("description") : t("managerDescription")}
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
                    <Label htmlFor="employeeNumber">{t("employeeNumber")}</Label>
                    <Input
                      id="employeeNumber"
                      maxLength={4}
                      inputMode="numeric"
                      {...createForm.register("employeeNumber")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t("fullName")}</Label>
                    <Input id="fullName" {...createForm.register("fullName")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("phone")}</Label>
                    <Input
                      id="phone"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="09xxxxxxxx"
                      {...createForm.register("phone")}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("phoneHint")}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">{t("role")}</Label>
                    <select
                      id="role"
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                      {...createForm.register("role")}
                    >
                      <option value="employee">{tRoles("employee")}</option>
                      <option value="department_manager">
                        {tRoles("department_manager")}
                      </option>
                      <option value="admin">{tRoles("admin")}</option>
                    </select>
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

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Input
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="sm:max-w-xs"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="whitespace-nowrap">{t("filterRole")}</span>
            <select
              className={selectClassName}
              value={roleFilter}
              onChange={(event) =>
                handleRoleFilterChange(event.target.value as RoleFilter)
              }
            >
              <option value="">{t("filterAll")}</option>
              <option value="admin">{tRoles("admin")}</option>
              <option value="department_manager">
                {tRoles("department_manager")}
              </option>
              <option value="employee">{tRoles("employee")}</option>
            </select>
          </label>
          {canManage ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="whitespace-nowrap">{t("filterDepartment")}</span>
              <select
                className={selectClassName}
                value={departmentFilter}
                onChange={(event) =>
                  handleDepartmentFilterChange(event.target.value)
                }
              >
                <option value="">{t("filterAll")}</option>
                <option value="none">{t("filterNoDepartment")}</option>
                {(departmentsQuery.data ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="whitespace-nowrap">{t("filterStatus")}</span>
            <select
              className={selectClassName}
              value={statusFilter}
              onChange={(event) =>
                handleStatusFilterChange(event.target.value as StatusFilter)
              }
            >
              <option value="">{t("filterAll")}</option>
              <option value="active">{t("filterActive")}</option>
              <option value="inactive">{t("filterInactive")}</option>
            </select>
          </label>
        </div>
        {usersQuery.data ? (
          <p className="text-sm text-muted-foreground">
            {t("totalCount", { count: total })}
          </p>
        ) : null}
      </div>

      {selectedIds.size > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:flex-row sm:flex-wrap sm:items-center">
          <p className="text-sm font-medium">
            {t("selectedCount", { count: selectedIds.size })}
          </p>
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkAction("activate")}
                >
                  {t("activate")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkAction("deactivate")}
                >
                  {t("deactivate")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkAction("assignDepartment")}
                >
                  {t("assignDepartment")}
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setBulkAction("reset")}
            >
              {t("resetPassword")}
            </Button>
            {canManage ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => setBulkAction("delete")}
              >
                {t("delete")}
              </Button>
            ) : null}
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

      {usersQuery.isLoading ? <LoadingState /> : null}
      {usersQuery.isError ? (
        <ErrorState
          title={tCommon("errorTitle")}
          description={
            usersQuery.error instanceof Error
              ? usersQuery.error.message
              : undefined
          }
          onRetry={() => usersQuery.refetch()}
        />
      ) : null}

      {usersQuery.data && usersQuery.data.items.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={
            canManage ? t("emptyDescription") : t("emptyManagerDescription")
          }
        />
      ) : null}

      {usersQuery.data && usersQuery.data.items.length > 0 ? (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={allSelectableSelected}
                    onChange={toggleSelectAll}
                    aria-label={t("selectAll")}
                  />
                </TableHead>
                <SortableTableHead
                  label={t("employeeNumber")}
                  column="employeeNumber"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={t("fullName")}
                  column="fullName"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label={t("role")}
                  column="role"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <TableHead>{t("department")}</TableHead>
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
              {usersQuery.data.items.map((user) => {
                const isSelf = user.id === currentUserId;
                const checked = selectedIds.has(user.id);
                return (
                  <TableRow
                    key={user.id}
                    className={cn(
                      "cursor-pointer",
                      checked && "bg-muted/40",
                    )}
                    onClick={() => router.push(`/employees/${user.id}`)}
                  >
                    <TableCell
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      {!isSelf ? (
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={checked}
                          onChange={() => toggleSelect(user.id)}
                          aria-label={t("selectUser", { name: user.fullName })}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="font-medium">
                      {user.employeeNumber}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/employees/${user.id}`}
                        className="font-medium hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {user.fullName}
                      </Link>
                    </TableCell>
                    <TableCell>{tRoles(user.role)}</TableCell>
                    <TableCell>
                      {user.currentDepartment?.name ?? t("noDepartment")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "default" : "secondary"}>
                        {user.isActive ? t("active") : t("inactive")}
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
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      ) : null}

      <Dialog
        open={Boolean(bulkAction)}
        onOpenChange={(open) => {
          if (!open) {
            setBulkAction(null);
            setBulkDepartmentId("");
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
                    count: selectedUsers.length,
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>
          {bulkAction === "assignDepartment" ? (
            <div className="space-y-2">
              <Label htmlFor="bulk-department">{t("selectDepartment")}</Label>
              <select
                id="bulk-department"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={bulkDepartmentId}
                onChange={(event) => setBulkDepartmentId(event.target.value)}
              >
                <option value="">{t("selectDepartment")}</option>
                {(departmentsQuery.data ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
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
              disabled={
                bulkRunning ||
                (bulkAction === "assignDepartment" && !bulkDepartmentId)
              }
              onClick={() => void runBulkAction()}
            >
              {bulkRunning ? tCommon("saving") : tCommon("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
