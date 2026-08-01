"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  AttendanceEditDialog,
  canEmployeeEditAttendance,
} from "@/features/attendance/components/attendance-edit-dialog";
import { AttendanceSubmitForm } from "@/features/attendance/components/attendance-submit-form";
import { calendarDateInOrgTimezone } from "@/features/attendance/services/compute-hours";
import type { AttendanceRecord } from "@/features/attendance/types/attendance.types";
import type { WorkLog } from "@/features/work-logs/types/work-log.types";
import type { Role } from "@/lib/permissions";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  type TablePageSize,
} from "@/lib/table/constants";
import { formatDate, formatDateTime } from "@/lib/dates";
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

type AttendancePageClientProps = {
  viewerId: string;
  viewerRole: Role;
  canApprove: boolean;
  canCreateWorkLog: boolean;
};

type AttendanceListResult = {
  items: AttendanceRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalHoursSum: number;
};

type WorkLogListResult = {
  items: WorkLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type TaskOption = { id: string; title: string };

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as {
    data?: T;
    error?: { message?: string; code?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Request failed");
  }
  return payload.data as T;
}

function uiStateBadgeVariant(
  state: AttendanceRecord["uiState"],
): "default" | "secondary" | "destructive" | "outline" {
  switch (state) {
    case "currently_working":
      return "default";
    case "awaiting_approval":
      return "secondary";
    case "approved":
      return "outline";
    case "rejected":
      return "destructive";
    default:
      return "outline";
  }
}

export function AttendancePageClient({
  viewerId,
  viewerRole,
  canApprove,
  canCreateWorkLog,
}: AttendancePageClientProps) {
  const t = useTranslations("attendance");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const [tab, setTab] = useState("today");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsPageSize, setRecordsPageSize] =
    useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [approvalsPage, setApprovalsPage] = useState(1);
  const [rejectTarget, setRejectTarget] = useState<AttendanceRecord | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");

  const [editTarget, setEditTarget] = useState<AttendanceRecord | null>(null);
  const [correctTarget, setCorrectTarget] = useState<AttendanceRecord | null>(
    null,
  );
  const [correctClockIn, setCorrectClockIn] = useState("");
  const [correctClockOut, setCorrectClockOut] = useState("");
  const [correctBreak, setCorrectBreak] = useState("0");

  const [workLogsPage, setWorkLogsPage] = useState(1);
  const [workLogDialogOpen, setWorkLogDialogOpen] = useState(false);
  const [workLogTaskId, setWorkLogTaskId] = useState("");
  const [workLogDate, setWorkLogDate] = useState("");
  const [workLogHours, setWorkLogHours] = useState("1");
  const [workLogDescription, setWorkLogDescription] = useState("");

  const showEmployeeColumn =
    viewerRole === "admin" || viewerRole === "department_manager";

  const todayQuery = useQuery({
    queryKey: ["attendance", "today"],
    queryFn: async () => {
      const response = await fetch("/api/attendance/today");
      return readApi<AttendanceRecord | null>(response);
    },
  });

  const recordsQuery = useQuery({
    queryKey: [
      "attendance",
      "records",
      recordsPage,
      recordsPageSize,
      dateFrom,
      dateTo,
      statusFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(recordsPage),
        pageSize: String(recordsPageSize),
        sortBy: "date",
        sortDir: "desc",
      });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (statusFilter) params.set("status", statusFilter);
      const response = await fetch(`/api/attendance?${params}`);
      return readApi<AttendanceListResult>(response);
    },
    enabled: tab === "records",
  });

  const approvalsQuery = useQuery({
    queryKey: ["attendance", "approvals", approvalsPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(approvalsPage),
        pageSize: String(DEFAULT_TABLE_PAGE_SIZE),
        awaitingApproval: "true",
        sortBy: "date",
        sortDir: "desc",
      });
      const response = await fetch(`/api/attendance?${params}`);
      return readApi<AttendanceListResult>(response);
    },
    enabled: tab === "approvals" && canApprove,
  });

  const workLogsQuery = useQuery({
    queryKey: ["work-logs", workLogsPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(workLogsPage),
        pageSize: String(DEFAULT_TABLE_PAGE_SIZE),
        sortBy: "date",
        sortDir: "desc",
      });
      const response = await fetch(`/api/work-logs?${params}`);
      return readApi<WorkLogListResult>(response);
    },
    enabled: tab === "workLogs",
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks", "for-work-log"],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
      });
      const response = await fetch(`/api/tasks?${params}`);
      const data = await readApi<{ items: TaskOption[] }>(response);
      return data.items;
    },
    enabled: workLogDialogOpen,
  });

  const invalidateAttendance = async () => {
    await queryClient.invalidateQueries({ queryKey: ["attendance"] });
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/attendance/${id}/approve`, {
        method: "POST",
      });
      return readApi<AttendanceRecord>(response);
    },
    onSuccess: async () => {
      setSuccessMessage(t("approveSuccess"));
      setActionError(null);
      await invalidateAttendance();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectTarget) throw new Error("missing");
      const response = await fetch(`/api/attendance/${rejectTarget.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      return readApi<AttendanceRecord>(response);
    },
    onSuccess: async () => {
      setRejectTarget(null);
      setRejectReason("");
      setSuccessMessage(t("rejectSuccess"));
      setActionError(null);
      await invalidateAttendance();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const correctMutation = useMutation({
    mutationFn: async () => {
      if (!correctTarget) throw new Error("missing");
      const response = await fetch(`/api/attendance/${correctTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clockIn: new Date(correctClockIn).toISOString(),
          clockOut: new Date(correctClockOut).toISOString(),
          breakMinutes: Number(correctBreak) || 0,
        }),
      });
      return readApi<AttendanceRecord>(response);
    },
    onSuccess: async () => {
      setCorrectTarget(null);
      setSuccessMessage(t("correctSuccess"));
      setActionError(null);
      await invalidateAttendance();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const createWorkLogMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/work-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: workLogTaskId,
          date: workLogDate,
          hours: Number(workLogHours),
          description: workLogDescription || null,
        }),
      });
      return readApi<WorkLog>(response);
    },
    onSuccess: async () => {
      setWorkLogDialogOpen(false);
      setWorkLogTaskId("");
      setWorkLogDescription("");
      setSuccessMessage(t("workLogCreateSuccess"));
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["work-logs"] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const deleteWorkLogMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/work-logs/${id}`, { method: "DELETE" });
      return readApi<{ ok: boolean }>(response);
    },
    onSuccess: async () => {
      setSuccessMessage(t("workLogDeleteSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["work-logs"] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const tabItems = useMemo(() => {
    const items = [
      { id: "today", label: t("tabToday") },
      { id: "records", label: t("tabRecords") },
    ];
    if (canApprove) {
      items.push({ id: "approvals", label: t("tabApprovals") });
    }
    items.push({ id: "workLogs", label: t("tabWorkLogs") });
    return items;
  }, [canApprove, t]);

  const today = todayQuery.data;
  const hasToday = Boolean(today);

  function openCorrectDialog(record: AttendanceRecord) {
    setCorrectTarget(record);
    setCorrectClockIn(record.clockIn.slice(0, 16));
    setCorrectClockOut(record.clockOut ? record.clockOut.slice(0, 16) : "");
    setCorrectBreak(String(record.breakMinutes));
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("description")} />

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

      <Tabs items={tabItems} value={tab} onValueChange={setTab}>
        <TabPanel when="today" active={tab}>
          {todayQuery.isLoading ? <LoadingState /> : null}
          {todayQuery.isError ? (
            <ErrorState
              title={tCommon("errorTitle")}
              description={(todayQuery.error as Error).message}
              onRetry={() => void todayQuery.refetch()}
            />
          ) : null}
          {!todayQuery.isLoading && !todayQuery.isError ? (
            <div className="space-y-4 rounded-lg border p-4">
              {!hasToday ? (
                <AttendanceSubmitForm
                  viewerId={viewerId}
                  defaultDate={calendarDateInOrgTimezone()}
                  onSuccess={() => {
                    setActionError(null);
                    setSuccessMessage(t("submitSuccess"));
                  }}
                />
              ) : today ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={uiStateBadgeVariant(today.uiState)}>
                      {t(`uiState_${today.uiState}`)}
                    </Badge>
                  </div>
                  <p className="text-sm">
                    {t("todaySummary", {
                      in: formatDateTime(today.clockIn),
                      out: today.clockOut
                        ? formatDateTime(today.clockOut)
                        : "—",
                      hours:
                        today.totalHours != null
                          ? String(today.totalHours)
                          : "—",
                    })}
                  </p>
                  {today.uiState === "rejected" && today.rejectionReason ? (
                    <p className="text-destructive text-sm">
                      {t("rejectionReason", {
                        reason: today.rejectionReason,
                      })}
                    </p>
                  ) : null}
                  {canEmployeeEditAttendance(today) ? (
                    <Button
                      variant="outline"
                      onClick={() => setEditTarget(today)}
                    >
                      {t("editAttendance")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </TabPanel>

        <TabPanel when="records" active={tab}>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label htmlFor="dateFrom">{t("dateFrom")}</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setRecordsPage(1);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dateTo">{t("dateTo")}</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setRecordsPage(1);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="statusFilter">{t("status")}</Label>
              <select
                id="statusFilter"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setRecordsPage(1);
                }}
              >
                <option value="">{t("allStatuses")}</option>
                <option value="pending">{t("status_pending")}</option>
                <option value="approved">{t("status_approved")}</option>
                <option value="rejected">{t("status_rejected")}</option>
              </select>
            </div>
          </div>

          {recordsQuery.data ? (
            <p className="text-muted-foreground mb-2 text-sm">
              {t("totalHoursSum", {
                hours: String(recordsQuery.data.totalHoursSum),
              })}
            </p>
          ) : null}

          {recordsQuery.isLoading ? <LoadingState /> : null}
          {recordsQuery.isError ? (
            <ErrorState
              title={tCommon("errorTitle")}
              description={(recordsQuery.error as Error).message}
              onRetry={() => void recordsQuery.refetch()}
            />
          ) : null}
          {recordsQuery.data && recordsQuery.data.items.length === 0 ? (
            <EmptyState
              title={t("recordsEmptyTitle")}
              description={t("recordsEmptyDescription")}
            />
          ) : null}
          {recordsQuery.data && recordsQuery.data.items.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    {showEmployeeColumn ? (
                      <TableHead>{t("employee")}</TableHead>
                    ) : null}
                    <TableHead>{t("clockIn")}</TableHead>
                    <TableHead>{t("clockOut")}</TableHead>
                    <TableHead>{t("breakMinutes")}</TableHead>
                    <TableHead>{t("totalHours")}</TableHead>
                    <TableHead>{t("state")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recordsQuery.data.items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      {showEmployeeColumn ? (
                        <TableCell>
                          {row.user?.fullName ?? "—"}
                        </TableCell>
                      ) : null}
                      <TableCell>{formatDateTime(row.clockIn)}</TableCell>
                      <TableCell>
                        {row.clockOut ? formatDateTime(row.clockOut) : "—"}
                      </TableCell>
                      <TableCell>{row.breakMinutes}</TableCell>
                      <TableCell>
                        {row.totalHours != null ? row.totalHours : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={uiStateBadgeVariant(row.uiState)}>
                          {t(`uiState_${row.uiState}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-2 space-x-reverse">
                        {row.userId === viewerId &&
                        canEmployeeEditAttendance(row) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditTarget(row)}
                          >
                            {t("editAttendance")}
                          </Button>
                        ) : null}
                        {viewerRole === "admin" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openCorrectDialog(row)}
                          >
                            {t("adminCorrect")}
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                page={recordsQuery.data.page}
                pageSize={recordsQuery.data.pageSize as TablePageSize}
                total={recordsQuery.data.total}
                onPageChange={setRecordsPage}
                onPageSizeChange={(size) => {
                  setRecordsPageSize(size);
                  setRecordsPage(1);
                }}
              />
            </>
          ) : null}
        </TabPanel>

        {canApprove ? (
          <TabPanel when="approvals" active={tab}>
            {approvalsQuery.isLoading ? <LoadingState /> : null}
            {approvalsQuery.isError ? (
              <ErrorState
                title={tCommon("errorTitle")}
                description={(approvalsQuery.error as Error).message}
                onRetry={() => void approvalsQuery.refetch()}
              />
            ) : null}
            {approvalsQuery.data && approvalsQuery.data.items.length === 0 ? (
              <EmptyState
                title={t("approvalsEmptyTitle")}
                description={t("approvalsEmptyDescription")}
              />
            ) : null}
            {approvalsQuery.data && approvalsQuery.data.items.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("employee")}</TableHead>
                      <TableHead>{t("totalHours")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvalsQuery.data.items
                      .filter((row) => row.userId !== viewerId)
                      .map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{formatDate(row.date)}</TableCell>
                          <TableCell>{row.user?.fullName ?? "—"}</TableCell>
                          <TableCell>{row.totalHours ?? "—"}</TableCell>
                          <TableCell className="space-x-2 space-x-reverse">
                            <Button
                              size="sm"
                              onClick={() => approveMutation.mutate(row.id)}
                              disabled={approveMutation.isPending}
                            >
                              {t("approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setRejectTarget(row);
                                setRejectReason("");
                              }}
                            >
                              {t("reject")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                <TablePagination
                  page={approvalsQuery.data.page}
                  pageSize={
                    approvalsQuery.data.pageSize as TablePageSize
                  }
                  total={approvalsQuery.data.total}
                  onPageChange={setApprovalsPage}
                  onPageSizeChange={() => undefined}
                />
              </>
            ) : null}
          </TabPanel>
        ) : null}

        <TabPanel when="workLogs" active={tab}>
          {canCreateWorkLog ? (
            <div className="mb-4">
              <Button
                onClick={() => {
                  setWorkLogDialogOpen(true);
                  setWorkLogDate(new Date().toISOString().slice(0, 10));
                }}
              >
                {t("addWorkLog")}
              </Button>
            </div>
          ) : null}

          {workLogsQuery.isLoading ? <LoadingState /> : null}
          {workLogsQuery.isError ? (
            <ErrorState
              title={tCommon("errorTitle")}
              description={(workLogsQuery.error as Error).message}
              onRetry={() => void workLogsQuery.refetch()}
            />
          ) : null}
          {workLogsQuery.data && workLogsQuery.data.items.length === 0 ? (
            <EmptyState
              title={t("workLogsEmptyTitle")}
              description={t("workLogsEmptyDescription")}
            />
          ) : null}
          {workLogsQuery.data && workLogsQuery.data.items.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    {showEmployeeColumn ? (
                      <TableHead>{t("employee")}</TableHead>
                    ) : null}
                    <TableHead>{t("task")}</TableHead>
                    <TableHead>{t("hours")}</TableHead>
                    <TableHead>{t("description")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workLogsQuery.data.items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      {showEmployeeColumn ? (
                        <TableCell>{row.user?.fullName ?? "—"}</TableCell>
                      ) : null}
                      <TableCell>
                        {row.task?.title ??
                          (row.taskId == null ? t("entryTypeGeneral") : "—")}
                      </TableCell>
                      <TableCell>{row.hours}</TableCell>
                      <TableCell>{row.description ?? "—"}</TableCell>
                      <TableCell>
                        {row.userId === viewerId || viewerRole === "admin" ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteWorkLogMutation.mutate(row.id)}
                          >
                            {t("delete")}
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                page={workLogsQuery.data.page}
                pageSize={workLogsQuery.data.pageSize as TablePageSize}
                total={workLogsQuery.data.total}
                onPageChange={setWorkLogsPage}
                onPageSizeChange={() => undefined}
              />
            </>
          ) : null}
        </TabPanel>
      </Tabs>

      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
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
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={rejectReason.trim().length < 2 || rejectMutation.isPending}
              onClick={() => rejectMutation.mutate()}
            >
              {t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AttendanceEditDialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        viewerId={viewerId}
        record={editTarget}
        onSuccess={() => {
          setActionError(null);
          setSuccessMessage(t("editSuccess"));
          void invalidateAttendance();
        }}
      />

      <Dialog
        open={Boolean(correctTarget)}
        onOpenChange={(open) => {
          if (!open) setCorrectTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("correctTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="correctClockIn">{t("clockIn")}</Label>
              <Input
                id="correctClockIn"
                type="datetime-local"
                value={correctClockIn}
                onChange={(e) => setCorrectClockIn(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="correctClockOut">{t("clockOut")}</Label>
              <Input
                id="correctClockOut"
                type="datetime-local"
                value={correctClockOut}
                onChange={(e) => setCorrectClockOut(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="correctBreak">{t("breakMinutes")}</Label>
              <Input
                id="correctBreak"
                type="number"
                min={0}
                value={correctBreak}
                onChange={(e) => setCorrectBreak(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectTarget(null)}>
              {tCommon("cancel")}
            </Button>
            <Button
              disabled={
                !correctClockIn ||
                !correctClockOut ||
                correctMutation.isPending
              }
              onClick={() => correctMutation.mutate()}
            >
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={workLogDialogOpen} onOpenChange={setWorkLogDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addWorkLog")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="workLogTask">{t("task")}</Label>
              <select
                id="workLogTask"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={workLogTaskId}
                onChange={(e) => setWorkLogTaskId(e.target.value)}
              >
                <option value="">{t("selectTask")}</option>
                {(tasksQuery.data ?? []).map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="workLogDate">{t("date")}</Label>
              <Input
                id="workLogDate"
                type="date"
                value={workLogDate}
                onChange={(e) => setWorkLogDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="workLogHours">{t("hours")}</Label>
              <Input
                id="workLogHours"
                type="number"
                min={0.25}
                step={0.25}
                value={workLogHours}
                onChange={(e) => setWorkLogHours(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="workLogDescription">{t("description")}</Label>
              <Input
                id="workLogDescription"
                value={workLogDescription}
                onChange={(e) => setWorkLogDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWorkLogDialogOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              disabled={
                !workLogTaskId ||
                !workLogDate ||
                Number(workLogHours) <= 0 ||
                createWorkLogMutation.isPending
              }
              onClick={() => createWorkLogMutation.mutate()}
            >
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
