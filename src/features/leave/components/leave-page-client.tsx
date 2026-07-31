"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { LeaveRequestForm } from "@/features/leave/components/leave-request-form";
import type { LeaveBalance, LeaveRequest, LeaveType } from "@/features/leave/types/leave.types";
import type { Role } from "@/lib/permissions";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  type TablePageSize,
} from "@/lib/table/constants";
import { formatDate } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { TablePagination } from "@/components/shared/table-pagination";
import { Tabs, TabPanel } from "@/components/shared/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

type LeavePageClientProps = {
  viewerRole: Role;
  canManage: boolean;
};

type LeaveListResult = {
  items: LeaveRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type EmployeeOption = {
  id: string;
  fullName: string;
  employeeNumber: string;
};

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as {
    data?: T;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Request failed");
  }
  return payload.data as T;
}

export function LeavePageClient({
  viewerRole,
  canManage,
}: LeavePageClientProps) {
  const t = useTranslations("leave");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const [tab, setTab] = useState("requests");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);

  const [dialogOpen, setDialogOpen] = useState(false);

  const [typeName, setTypeName] = useState("");
  const [typeDescription, setTypeDescription] = useState("");
  const [balanceUserId, setBalanceUserId] = useState("");
  const [balanceTypeId, setBalanceTypeId] = useState("");
  const [balanceYear, setBalanceYear] = useState(String(new Date().getFullYear()));
  const [balanceAllocated, setBalanceAllocated] = useState("21");

  const year = new Date().getFullYear();

  const typesQuery = useQuery({
    queryKey: ["leave-types", canManage],
    queryFn: async () => {
      const qs = canManage ? "?includeInactive=true" : "";
      const response = await fetch(`/api/leave-types${qs}`);
      return readApi<LeaveType[]>(response);
    },
  });

  const requestsQuery = useQuery({
    queryKey: ["leave-requests", page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      const response = await fetch(`/api/leave-requests?${params}`);
      return readApi<LeaveListResult>(response);
    },
  });

  const balancesQuery = useQuery({
    queryKey: ["leave-balances", year],
    queryFn: async () => {
      const response = await fetch(`/api/leave-balances?year=${year}`);
      return readApi<LeaveBalance[]>(response);
    },
  });

  const employeesQuery = useQuery({
    queryKey: ["employees-for-leave"],
    enabled: canManage && tab === "manage",
    queryFn: async () => {
      const response = await fetch("/api/users?page=1&pageSize=100");
      const data = await readApi<{ items: EmployeeOption[] }>(response);
      return data.items;
    },
  });

  const createTypeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/leave-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: typeName,
          description: typeDescription || null,
        }),
      });
      return readApi<LeaveType>(response);
    },
    onSuccess: async () => {
      setSuccessMessage(t("typeCreateSuccess"));
      setTypeName("");
      setTypeDescription("");
      await queryClient.invalidateQueries({ queryKey: ["leave-types"] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/leave-types/${id}`, {
        method: "DELETE",
      });
      return readApi<LeaveType>(response);
    },
    onSuccess: async () => {
      setSuccessMessage(t("deactivateSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["leave-types"] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const balanceMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/leave-balances", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: balanceUserId,
          leaveTypeId: balanceTypeId,
          year: Number(balanceYear),
          allocatedDays: Number(balanceAllocated),
        }),
      });
      return readApi<LeaveBalance>(response);
    },
    onSuccess: async () => {
      setSuccessMessage(t("balanceSaveSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const activeTypes = (typesQuery.data ?? []).filter((x) => x.isActive);
  const showEmployee =
    viewerRole === "admin" || viewerRole === "department_manager";

  const tabs = [
    { id: "requests", label: t("tabMyRequests") },
    { id: "balances", label: t("tabBalances") },
    ...(canManage ? [{ id: "manage", label: t("tabManage") }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button type="button" onClick={() => setDialogOpen(true)}>
            {t("newRequest")}
          </Button>
        }
      />

      {successMessage ? (
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}
      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs items={tabs} value={tab} onValueChange={setTab}>
        <TabPanel when="requests" active={tab}>
          {requestsQuery.isLoading ? <LoadingState /> : null}
          {requestsQuery.isError ? (
            <ErrorState
              title={tCommon("errorTitle")}
              onRetry={() => void requestsQuery.refetch()}
              description={
                requestsQuery.error instanceof Error
                  ? requestsQuery.error.message
                  : undefined
              }
            />
          ) : null}
          {requestsQuery.data && requestsQuery.data.items.length === 0 ? (
            <EmptyState
              title={t("emptyRequestsTitle")}
              description={t("emptyRequestsDescription")}
            />
          ) : null}
          {requestsQuery.data && requestsQuery.data.items.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {showEmployee ? <TableHead>{t("employee")}</TableHead> : null}
                    <TableHead>{t("leaveType")}</TableHead>
                    <TableHead>{t("startDate")}</TableHead>
                    <TableHead>{t("endDate")}</TableHead>
                    <TableHead>{t("days")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestsQuery.data.items.map((row) => (
                    <TableRow key={row.id}>
                      {showEmployee ? (
                        <TableCell>{row.user?.fullName ?? "—"}</TableCell>
                      ) : null}
                      <TableCell>{row.leaveType?.name ?? "—"}</TableCell>
                      <TableCell>{formatDate(row.startDate)}</TableCell>
                      <TableCell>{formatDate(row.endDate)}</TableCell>
                      <TableCell>{row.days}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {t(`status_${row.status}`)}
                        </Badge>
                        {row.rejectionReason ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("rejectionReason", {
                              reason: row.rejectionReason,
                            })}
                          </p>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                page={requestsQuery.data.page}
                pageSize={pageSize}
                total={requestsQuery.data.total}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </>
          ) : null}
        </TabPanel>

        <TabPanel when="balances" active={tab}>
          {balancesQuery.isLoading ? <LoadingState /> : null}
          {balancesQuery.isError ? (
            <ErrorState
              title={tCommon("errorTitle")}
              onRetry={() => void balancesQuery.refetch()}
            />
          ) : null}
          {balancesQuery.data && balancesQuery.data.length === 0 ? (
            <EmptyState
              title={t("emptyBalancesTitle")}
              description={t("emptyBalancesDescription")}
            />
          ) : null}
          {balancesQuery.data && balancesQuery.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {showEmployee ? <TableHead>{t("employee")}</TableHead> : null}
                  <TableHead>{t("leaveType")}</TableHead>
                  <TableHead>{t("year")}</TableHead>
                  <TableHead>{t("allocated")}</TableHead>
                  <TableHead>{t("used")}</TableHead>
                  <TableHead>{t("pending")}</TableHead>
                  <TableHead>{t("remaining")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balancesQuery.data.map((row) => (
                  <TableRow key={row.id}>
                    {showEmployee ? (
                      <TableCell>{row.user?.fullName ?? "—"}</TableCell>
                    ) : null}
                    <TableCell>{row.leaveType?.name ?? "—"}</TableCell>
                    <TableCell>{row.year}</TableCell>
                    <TableCell>{row.allocatedDays}</TableCell>
                    <TableCell>{row.usedDays}</TableCell>
                    <TableCell>{row.pendingDays}</TableCell>
                    <TableCell>{row.remainingDays}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </TabPanel>

        {canManage ? (
          <TabPanel when="manage" active={tab}>
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-base font-semibold">{t("addType")}</h3>
                <div className="space-y-2">
                  <Label htmlFor="typeName">{t("typeName")}</Label>
                  <Input
                    id="typeName"
                    value={typeName}
                    onChange={(e) => setTypeName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="typeDescription">{t("typeDescription")}</Label>
                  <Input
                    id="typeDescription"
                    value={typeDescription}
                    onChange={(e) => setTypeDescription(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  disabled={!typeName.trim() || createTypeMutation.isPending}
                  onClick={() => createTypeMutation.mutate()}
                >
                  {t("addType")}
                </Button>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("typeName")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(typesQuery.data ?? []).map((type) => (
                      <TableRow key={type.id}>
                        <TableCell>{type.name}</TableCell>
                        <TableCell>
                          {type.isActive ? t("active") : t("inactive")}
                        </TableCell>
                        <TableCell>
                          {type.isActive ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => deactivateMutation.mutate(type.id)}
                            >
                              {t("deactivate")}
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-4">
                <h3 className="text-base font-semibold">{t("allocateBalance")}</h3>
                <div className="space-y-2">
                  <Label htmlFor="balanceUser">{t("employee")}</Label>
                  <select
                    id="balanceUser"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={balanceUserId}
                    onChange={(e) => setBalanceUserId(e.target.value)}
                  >
                    <option value="">{t("selectType")}</option>
                    {(employeesQuery.data ?? []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.employeeNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="balanceType">{t("leaveType")}</Label>
                  <select
                    id="balanceType"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={balanceTypeId}
                    onChange={(e) => setBalanceTypeId(e.target.value)}
                  >
                    <option value="">{t("selectType")}</option>
                    {activeTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="balanceYear">{t("year")}</Label>
                  <Input
                    id="balanceYear"
                    value={balanceYear}
                    onChange={(e) => setBalanceYear(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="balanceAllocated">{t("allocatedDays")}</Label>
                  <Input
                    id="balanceAllocated"
                    type="number"
                    min={0}
                    value={balanceAllocated}
                    onChange={(e) => setBalanceAllocated(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  disabled={
                    !balanceUserId ||
                    !balanceTypeId ||
                    balanceMutation.isPending
                  }
                  onClick={() => balanceMutation.mutate()}
                >
                  {tCommon("save")}
                </Button>
              </div>
            </div>
          </TabPanel>
        ) : null}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newRequest")}</DialogTitle>
          </DialogHeader>
          {typesQuery.data ? (
            <LeaveRequestForm
              leaveTypes={typesQuery.data}
              resetOnSuccess
              submitLabel={tCommon("confirm")}
              onSuccess={() => {
                setSuccessMessage(t("createSuccess"));
                setActionError(null);
                setDialogOpen(false);
              }}
            />
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
