"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { EmployeeRequest } from "@/features/employee-requests/types/employee-request.types";
import type { LeaveRequest } from "@/features/leave/types/leave.types";
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

type ApprovalsPageClientProps = {
  canApproveLeave: boolean;
  canApproveEmployeeRequest: boolean;
};

type ListResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type RejectTarget =
  | { kind: "leave"; id: string }
  | { kind: "employee"; id: string };

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

export function ApprovalsPageClient({
  canApproveLeave,
  canApproveEmployeeRequest,
}: ApprovalsPageClientProps) {
  const t = useTranslations("approvals");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const defaultTab = canApproveLeave
    ? "leave"
    : canApproveEmployeeRequest
      ? "extensions"
      : "leave";

  const [tab, setTab] = useState(defaultTab);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const leaveQuery = useQuery({
    queryKey: ["approvals-leave", page, pageSize],
    enabled: canApproveLeave && tab === "leave",
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status: "pending",
      });
      const response = await fetch(`/api/leave-requests?${params}`);
      return readApi<ListResult<LeaveRequest>>(response);
    },
  });

  const extensionsQuery = useQuery({
    queryKey: ["approvals-extensions", page, pageSize],
    enabled: canApproveEmployeeRequest && tab === "extensions",
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status: "pending",
        type: "extension",
      });
      const response = await fetch(`/api/employee-requests?${params}`);
      return readApi<ListResult<EmployeeRequest>>(response);
    },
  });

  const excusalsQuery = useQuery({
    queryKey: ["approvals-excusals", page, pageSize],
    enabled: canApproveEmployeeRequest && tab === "excusals",
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status: "pending",
        type: "excusal",
      });
      const response = await fetch(`/api/employee-requests?${params}`);
      return readApi<ListResult<EmployeeRequest>>(response);
    },
  });

  const approveLeaveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/leave-requests/${id}/approve`, {
        method: "POST",
      });
      return readApi(response);
    },
    onSuccess: async () => {
      setSuccessMessage(t("approveSuccess"));
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["approvals-leave"] });
      await queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const approveEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/employee-requests/${id}/approve`, {
        method: "POST",
      });
      return readApi(response);
    },
    onSuccess: async () => {
      setSuccessMessage(t("approveSuccess"));
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["approvals-extensions"] });
      await queryClient.invalidateQueries({ queryKey: ["approvals-excusals"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectTarget) return;
      const path =
        rejectTarget.kind === "leave"
          ? `/api/leave-requests/${rejectTarget.id}/reject`
          : `/api/employee-requests/${rejectTarget.id}/reject`;
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      return readApi(response);
    },
    onSuccess: async () => {
      setSuccessMessage(t("rejectSuccess"));
      setActionError(null);
      setRejectTarget(null);
      setRejectReason("");
      await queryClient.invalidateQueries({ queryKey: ["approvals-leave"] });
      await queryClient.invalidateQueries({ queryKey: ["approvals-extensions"] });
      await queryClient.invalidateQueries({ queryKey: ["approvals-excusals"] });
      await queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const tabs = [
    ...(canApproveLeave ? [{ id: "leave", label: t("tabLeave") }] : []),
    ...(canApproveEmployeeRequest
      ? [
          { id: "extensions", label: t("tabExtensions") },
          { id: "excusals", label: t("tabExcusals") },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

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

      <Tabs
        items={tabs}
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setPage(1);
        }}
      >
        {canApproveLeave ? (
          <TabPanel when="leave" active={tab}>
            {leaveQuery.isLoading ? <LoadingState /> : null}
            {leaveQuery.isError ? (
              <ErrorState
                title={tCommon("errorTitle")}
                onRetry={() => void leaveQuery.refetch()}
              />
            ) : null}
            {leaveQuery.data && leaveQuery.data.items.length === 0 ? (
              <EmptyState
                title={t("emptyLeaveTitle")}
                description={t("emptyLeaveDescription")}
              />
            ) : null}
            {leaveQuery.data && leaveQuery.data.items.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("employee")}</TableHead>
                      <TableHead>{t("leaveType")}</TableHead>
                      <TableHead>{t("dates")}</TableHead>
                      <TableHead>{t("days")}</TableHead>
                      <TableHead>{t("reason")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveQuery.data.items.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.user?.fullName ?? "—"}</TableCell>
                        <TableCell>{row.leaveType?.name ?? "—"}</TableCell>
                        <TableCell>
                          {formatDate(row.startDate)} – {formatDate(row.endDate)}
                        </TableCell>
                        <TableCell>{row.days}</TableCell>
                        <TableCell>{row.reason ?? "—"}</TableCell>
                        <TableCell className="space-x-2 space-x-reverse">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => approveLeaveMutation.mutate(row.id)}
                          >
                            {t("approve")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setRejectTarget({ kind: "leave", id: row.id })
                            }
                          >
                            {t("reject")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  page={leaveQuery.data.page}
                  pageSize={pageSize}
                  total={leaveQuery.data.total}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              </>
            ) : null}
          </TabPanel>
        ) : null}

        {canApproveEmployeeRequest ? (
          <>
            <TabPanel when="extensions" active={tab}>
              <EmployeeRequestTable
                query={extensionsQuery}
                emptyTitle={t("emptyExtensionsTitle")}
                emptyDescription={t("emptyExtensionsDescription")}
                showRequestedDate
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                onApprove={(id) => approveEmployeeMutation.mutate(id)}
                onReject={(id) => setRejectTarget({ kind: "employee", id })}
                labels={{
                  employee: t("employee"),
                  task: t("task"),
                  requestedDate: t("requestedDate"),
                  reason: t("reason"),
                  actions: t("actions"),
                  approve: t("approve"),
                  reject: t("reject"),
                  errorTitle: tCommon("errorTitle"),
                }}
              />
            </TabPanel>
            <TabPanel when="excusals" active={tab}>
              <EmployeeRequestTable
                query={excusalsQuery}
                emptyTitle={t("emptyExcusalsTitle")}
                emptyDescription={t("emptyExcusalsDescription")}
                showRequestedDate={false}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                onApprove={(id) => approveEmployeeMutation.mutate(id)}
                onReject={(id) => setRejectTarget({ kind: "employee", id })}
                labels={{
                  employee: t("employee"),
                  task: t("task"),
                  requestedDate: t("requestedDate"),
                  reason: t("reason"),
                  actions: t("actions"),
                  approve: t("approve"),
                  reject: t("reject"),
                  errorTitle: tCommon("errorTitle"),
                }}
              />
            </TabPanel>
          </>
        ) : null}
      </Tabs>

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectReason">{t("rejectionReasonLabel")}</Label>
            <Input
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectTarget(null)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={rejectReason.trim().length < 2 || rejectMutation.isPending}
              onClick={() => rejectMutation.mutate()}
            >
              {t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmployeeRequestTable({
  query,
  emptyTitle,
  emptyDescription,
  showRequestedDate,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onApprove,
  onReject,
  labels,
}: {
  query: {
    isLoading: boolean;
    isError: boolean;
    data?: ListResult<EmployeeRequest>;
    refetch: () => unknown;
  };
  emptyTitle: string;
  emptyDescription: string;
  showRequestedDate: boolean;
  pageSize: TablePageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: TablePageSize) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  labels: {
    employee: string;
    task: string;
    requestedDate: string;
    reason: string;
    actions: string;
    approve: string;
    reject: string;
    errorTitle: string;
  };
}) {
  if (query.isLoading) return <LoadingState />;
  if (query.isError) {
    return (
      <ErrorState
        title={labels.errorTitle}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!query.data || query.data.items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{labels.employee}</TableHead>
            <TableHead>{labels.task}</TableHead>
            {showRequestedDate ? (
              <TableHead>{labels.requestedDate}</TableHead>
            ) : null}
            <TableHead>{labels.reason}</TableHead>
            <TableHead>{labels.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.data.items.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.user?.fullName ?? "—"}</TableCell>
              <TableCell>{row.taskTitle ?? "—"}</TableCell>
              {showRequestedDate ? (
                <TableCell>
                  {row.requestedDate ? formatDate(row.requestedDate) : "—"}
                </TableCell>
              ) : null}
              <TableCell>{row.reason ?? "—"}</TableCell>
              <TableCell className="space-x-2 space-x-reverse">
                <Button type="button" size="sm" onClick={() => onApprove(row.id)}>
                  {labels.approve}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onReject(row.id)}
                >
                  {labels.reject}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        page={query.data.page}
        pageSize={pageSize}
        total={query.data.total}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </>
  );
}
