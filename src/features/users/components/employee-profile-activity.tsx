"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { AttendanceRecord } from "@/features/attendance/types/attendance.types";
import {
  timeRangeLabel,
  uiStateBadgeVariant,
} from "@/features/attendance/components/attendance-display-utils";
import { AttendanceReviewDialog } from "@/features/attendance/components/attendance-review-dialog";
import type { EmployeeRequest } from "@/features/employee-requests/types/employee-request.types";
import type {
  LeaveBalance,
  LeaveRequest,
} from "@/features/leave/types/leave.types";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { TablePagination } from "@/components/shared/table-pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  type TablePageSize,
} from "@/lib/table/constants";

type ListResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

function requestStatusVariant(
  status: "pending" | "approved" | "rejected",
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "approved") return "default";
  if (status === "rejected") return "destructive";
  return "outline";
}

type PanelProps = {
  userId: string;
  canApprove?: boolean;
};

type RejectTarget =
  | { kind: "attendance"; id: string }
  | { kind: "leave"; id: string }
  | { kind: "employee_request"; id: string };

export function EmployeeProfileAttendancePanel({
  userId,
  canApprove = false,
}: PanelProps) {
  const t = useTranslations("employees");
  const tAttendance = useTranslations("attendance");
  const tApprovals = useTranslations("approvals");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const [reviewRecord, setReviewRecord] = useState<AttendanceRecord | null>(
    null,
  );
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["attendance", "profile", userId, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        userId,
        sortBy: "date",
        sortDir: "desc",
      });
      const response = await fetch(`/api/attendance?${params}`);
      return readApi<ListResult<AttendanceRecord>>(response);
    },
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["attendance", "profile", userId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["attendance", "profile-count", userId],
    });
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/attendance/${id}/approve`, {
        method: "POST",
      });
      return readApi(response);
    },
    onSuccess: async () => {
      setSuccessMessage(tApprovals("approveSuccess"));
      setActionError(null);
      setReviewRecord(null);
      await invalidate();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectTarget || rejectTarget.kind !== "attendance") return;
      const response = await fetch(
        `/api/attendance/${rejectTarget.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectReason }),
        },
      );
      return readApi(response);
    },
    onSuccess: async () => {
      setSuccessMessage(tApprovals("rejectSuccess"));
      setActionError(null);
      setRejectTarget(null);
      setRejectReason("");
      setReviewRecord(null);
      await invalidate();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  if (query.isLoading) return <LoadingState />;
  if (query.isError) {
    return (
      <ErrorState
        title={tCommon("errorTitle")}
        description={(query.error as Error).message}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title={t("emptyAttendanceTitle")}
        description={t("emptyAttendanceDescription")}
      />
    );
  }

  return (
    <div className="space-y-3">
      {successMessage ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}
      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tAttendance("date")}</TableHead>
              <TableHead>{tAttendance("entryTime")}</TableHead>
              <TableHead>{tAttendance("totalHours")}</TableHead>
              <TableHead>{tAttendance("state")}</TableHead>
              {canApprove ? (
                <TableHead>{tApprovals("actions")}</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => {
              const pending = row.uiState === "awaiting_approval";
              return (
                <TableRow key={row.id}>
                  <TableCell>{formatDate(row.date)}</TableCell>
                  <TableCell>
                    {timeRangeLabel(row.clockIn, row.clockOut)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.totalHours != null
                      ? tAttendance("hoursValue", { hours: row.totalHours })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={uiStateBadgeVariant(row.uiState)}>
                      {tAttendance(`uiState_${row.uiState}`)}
                    </Badge>
                    {row.rejectionReason ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {tAttendance("rejectionReason", {
                          reason: row.rejectionReason,
                        })}
                      </p>
                    ) : null}
                  </TableCell>
                  {canApprove ? (
                    <TableCell>
                      {pending ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setReviewRecord(row)}
                          >
                            {tAttendance("review")}
                          </Button>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
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

      <AttendanceReviewDialog
        record={reviewRecord}
        open={!!reviewRecord}
        onOpenChange={(open) => {
          if (!open) setReviewRecord(null);
        }}
        isApproving={approveMutation.isPending}
        canDecide={canApprove && reviewRecord?.uiState === "awaiting_approval"}
        onApprove={(id) => approveMutation.mutate(id)}
        onReject={(id) => {
          setReviewRecord(null);
          setRejectTarget({ kind: "attendance", id });
          setRejectReason("");
        }}
      />

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
            <DialogTitle>{tApprovals("rejectTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="profile-attendance-reject-reason">
              {tApprovals("rejectionReasonLabel")}
            </Label>
            <textarea
              id="profile-attendance-reject-reason"
              className="min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                rejectReason.trim().length < 2 || rejectMutation.isPending
              }
              onClick={() => rejectMutation.mutate()}
            >
              {tApprovals("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function EmployeeProfileLeavePanel({
  userId,
  canApprove = false,
}: PanelProps) {
  const t = useTranslations("employees");
  const tLeave = useTranslations("leave");
  const tApprovals = useTranslations("approvals");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const year = new Date().getFullYear();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const balancesQuery = useQuery({
    queryKey: ["leave-balances", "profile", userId, year],
    queryFn: async () => {
      const params = new URLSearchParams({
        userId,
        year: String(year),
      });
      const response = await fetch(`/api/leave-balances?${params}`);
      return readApi<LeaveBalance[]>(response);
    },
  });

  const requestsQuery = useQuery({
    queryKey: ["leave-requests", "profile", userId, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        userId,
        sortBy: "created_at",
        sortDir: "desc",
      });
      const response = await fetch(`/api/leave-requests?${params}`);
      return readApi<ListResult<LeaveRequest>>(response);
    },
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["leave-requests", "profile", userId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["leave-balances", "profile", userId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["leave-requests", "profile-count", userId],
    });
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/leave-requests/${id}/approve`, {
        method: "POST",
      });
      return readApi(response);
    },
    onSuccess: async () => {
      setSuccessMessage(tApprovals("approveSuccess"));
      setActionError(null);
      await invalidate();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectTarget || rejectTarget.kind !== "leave") return;
      const response = await fetch(
        `/api/leave-requests/${rejectTarget.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectReason }),
        },
      );
      return readApi(response);
    },
    onSuccess: async () => {
      setSuccessMessage(tApprovals("rejectSuccess"));
      setActionError(null);
      setRejectTarget(null);
      setRejectReason("");
      await invalidate();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const balances = balancesQuery.data ?? [];
  const items = requestsQuery.data?.items ?? [];
  const total = requestsQuery.data?.total ?? 0;

  return (
    <div className="space-y-6">
      {successMessage ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}
      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight">
          {t("leaveBalancesTitle")}
        </h3>
        {balancesQuery.isLoading ? <LoadingState /> : null}
        {balancesQuery.isError ? (
          <ErrorState
            title={tCommon("errorTitle")}
            description={(balancesQuery.error as Error).message}
            onRetry={() => void balancesQuery.refetch()}
          />
        ) : null}
        {balancesQuery.isSuccess && balances.length === 0 ? (
          <EmptyState
            title={tLeave("emptyBalancesTitle")}
            description={tLeave("emptyBalancesDescription")}
          />
        ) : null}
        {balances.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tLeave("leaveType")}</TableHead>
                  <TableHead>{tLeave("allocated")}</TableHead>
                  <TableHead>{tLeave("used")}</TableHead>
                  <TableHead>{tLeave("pending")}</TableHead>
                  <TableHead>{tLeave("remaining")}</TableHead>
                  <TableHead>{tLeave("year")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.leaveType?.name ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">
                      {row.allocatedDays}
                    </TableCell>
                    <TableCell className="tabular-nums">{row.usedDays}</TableCell>
                    <TableCell className="tabular-nums">
                      {row.pendingDays}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.remainingDays}
                    </TableCell>
                    <TableCell className="tabular-nums">{row.year}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight">
          {t("leaveRequestsTitle")}
        </h3>
        {requestsQuery.isLoading ? <LoadingState /> : null}
        {requestsQuery.isError ? (
          <ErrorState
            title={tCommon("errorTitle")}
            description={(requestsQuery.error as Error).message}
            onRetry={() => void requestsQuery.refetch()}
          />
        ) : null}
        {requestsQuery.isSuccess && items.length === 0 ? (
          <EmptyState
            title={t("emptyLeaveTitle")}
            description={t("emptyLeaveDescription")}
          />
        ) : null}
        {items.length > 0 ? (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tLeave("leaveType")}</TableHead>
                    <TableHead>{tLeave("startDate")}</TableHead>
                    <TableHead>{tLeave("endDate")}</TableHead>
                    <TableHead>{tLeave("days")}</TableHead>
                    <TableHead>{tLeave("status")}</TableHead>
                    {canApprove ? (
                      <TableHead>{tApprovals("actions")}</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.leaveType?.name ?? "—"}</TableCell>
                      <TableCell>{formatDate(row.startDate)}</TableCell>
                      <TableCell>{formatDate(row.endDate)}</TableCell>
                      <TableCell className="tabular-nums">{row.days}</TableCell>
                      <TableCell>
                        <Badge variant={requestStatusVariant(row.status)}>
                          {tLeave(`status_${row.status}`)}
                        </Badge>
                        {row.rejectionReason ? (
                          <p className="text-muted-foreground mt-1 text-xs">
                            {tLeave("rejectionReason", {
                              reason: row.rejectionReason,
                            })}
                          </p>
                        ) : null}
                      </TableCell>
                      {canApprove ? (
                        <TableCell>
                          {row.status === "pending" ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => approveMutation.mutate(row.id)}
                                disabled={approveMutation.isPending}
                              >
                                {tApprovals("approve")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setRejectTarget({
                                    kind: "leave",
                                    id: row.id,
                                  });
                                  setRejectReason("");
                                }}
                              >
                                {tApprovals("reject")}
                              </Button>
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      ) : null}
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
            <DialogTitle>{tApprovals("rejectTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="profile-leave-reject-reason">
              {tApprovals("rejectionReasonLabel")}
            </Label>
            <textarea
              id="profile-leave-reject-reason"
              className="min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                rejectReason.trim().length < 2 || rejectMutation.isPending
              }
              onClick={() => rejectMutation.mutate()}
            >
              {tApprovals("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function EmployeeProfileRequestsPanel({
  userId,
  canApprove = false,
}: PanelProps) {
  const t = useTranslations("employees");
  const tApprovals = useTranslations("approvals");
  const tDashboard = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["employee-requests", "profile", userId, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        userId,
        sortBy: "created_at",
        sortDir: "desc",
      });
      const response = await fetch(`/api/employee-requests?${params}`);
      return readApi<ListResult<EmployeeRequest>>(response);
    },
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["employee-requests", "profile", userId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["employee-requests", "profile-count", userId],
    });
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/employee-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return readApi(response);
    },
    onSuccess: async () => {
      setSuccessMessage(tApprovals("approveSuccess"));
      setActionError(null);
      await invalidate();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectTarget || rejectTarget.kind !== "employee_request") return;
      const response = await fetch(
        `/api/employee-requests/${rejectTarget.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectReason }),
        },
      );
      return readApi(response);
    },
    onSuccess: async () => {
      setSuccessMessage(tApprovals("rejectSuccess"));
      setActionError(null);
      setRejectTarget(null);
      setRejectReason("");
      await invalidate();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  if (query.isLoading) return <LoadingState />;
  if (query.isError) {
    return (
      <ErrorState
        title={tCommon("errorTitle")}
        description={(query.error as Error).message}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title={t("emptyRequestsTitle")}
        description={t("emptyRequestsDescription")}
      />
    );
  }

  return (
    <div className="space-y-3">
      {successMessage ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}
      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("requestType")}</TableHead>
              <TableHead>{tApprovals("task")}</TableHead>
              <TableHead>{tApprovals("requestedDate")}</TableHead>
              <TableHead>{tApprovals("reason")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              {canApprove ? (
                <TableHead>{tApprovals("actions")}</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {tDashboard(
                    row.type === "extension"
                      ? "requestKind_extension"
                      : "requestKind_excusal",
                  )}
                </TableCell>
                <TableCell>
                  {row.taskId ? (
                    <Link
                      href={`/tasks/${row.taskId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {row.taskTitle ?? row.taskId}
                    </Link>
                  ) : (
                    (row.taskTitle ?? "—")
                  )}
                </TableCell>
                <TableCell>
                  {row.requestedDate ? formatDate(row.requestedDate) : "—"}
                </TableCell>
                <TableCell className="max-w-[16rem] truncate">
                  {row.reason ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={requestStatusVariant(row.status)}>
                    {tDashboard(`status_${row.status}`)}
                  </Badge>
                  {row.rejectionReason ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {row.rejectionReason}
                    </p>
                  ) : null}
                </TableCell>
                {canApprove ? (
                  <TableCell>
                    {row.status === "pending" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => approveMutation.mutate(row.id)}
                          disabled={approveMutation.isPending}
                        >
                          {tApprovals("approve")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setRejectTarget({
                              kind: "employee_request",
                              id: row.id,
                            });
                            setRejectReason("");
                          }}
                        >
                          {tApprovals("reject")}
                        </Button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                ) : null}
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
            <DialogTitle>{tApprovals("rejectTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="profile-request-reject-reason">
              {tApprovals("rejectionReasonLabel")}
            </Label>
            <textarea
              id="profile-request-reject-reason"
              className="min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                rejectReason.trim().length < 2 || rejectMutation.isPending
              }
              onClick={() => rejectMutation.mutate()}
            >
              {tApprovals("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
