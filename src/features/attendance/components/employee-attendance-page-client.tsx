"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link2 } from "lucide-react";

import {
  AttendanceEditDialog,
  canEmployeeEditAttendance,
} from "@/features/attendance/components/attendance-edit-dialog";
import {
  groupAllocationsByDate,
  timeRangeLabel,
  uiStateBadgeVariant,
} from "@/features/attendance/components/attendance-display-utils";
import { AttendanceSubmitForm } from "@/features/attendance/components/attendance-submit-form";
import { calendarDateInOrgTimezone } from "@/features/attendance/services/compute-hours";
import type { AttendanceRecord } from "@/features/attendance/types/attendance.types";
import type { WorkLog } from "@/features/work-logs/types/work-log.types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { TablePagination } from "@/components/shared/table-pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { currentWeekBounds } from "@/lib/org-calendar";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  type TablePageSize,
} from "@/lib/table/constants";
import { formatDate } from "@/lib/dates";

type EmployeeAttendancePageClientProps = {
  viewerId: string;
};

type AttendanceListResult = {
  items: AttendanceRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type WorkLogListResult = {
  items: WorkLog[];
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

export function EmployeeAttendancePageClient({
  viewerId,
}: EmployeeAttendancePageClientProps) {
  const t = useTranslations("attendance");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);

  const todayDate = calendarDateInOrgTimezone();
  const weekBounds = currentWeekBounds(todayDate);

  const weekStatsQuery = useQuery({
    queryKey: ["attendance", "week-stats", weekBounds.start, weekBounds.end],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
        dateFrom: weekBounds.start,
        dateTo: weekBounds.end,
        sortBy: "date",
        sortDir: "desc",
      });
      const response = await fetch(`/api/attendance?${params}`);
      const data = await readApi<AttendanceListResult>(response);
      const approvedHours = data.items
        .filter((r) => r.status === "approved")
        .reduce((sum, r) => sum + (r.totalHours ?? 0), 0);
      const pendingCount = data.items.filter(
        (r) => r.status === "pending" && r.clockOut != null,
      ).length;
      return {
        approvedHours: Math.round(approvedHours * 100) / 100,
        pendingCount,
      };
    },
  });

  const recordsQuery = useQuery({
    queryKey: ["attendance", "employee-records", page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy: "date",
        sortDir: "desc",
      });
      const response = await fetch(`/api/attendance?${params}`);
      return readApi<AttendanceListResult>(response);
    },
  });

  const recordDates = recordsQuery.data?.items.map((r) => r.date) ?? [];
  const dateFrom =
    recordDates.length > 0
      ? recordDates.reduce((a, b) => (a < b ? a : b))
      : null;
  const dateTo =
    recordDates.length > 0
      ? recordDates.reduce((a, b) => (a > b ? a : b))
      : null;

  const workLogsQuery = useQuery({
    queryKey: ["work-logs", "employee-attendance", dateFrom, dateTo],
    enabled: Boolean(dateFrom && dateTo),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
        userId: viewerId,
        dateFrom: dateFrom!,
        dateTo: dateTo!,
        sortBy: "date",
        sortDir: "desc",
      });
      const response = await fetch(`/api/work-logs?${params}`);
      return readApi<WorkLogListResult>(response);
    },
  });

  const allocationsByDate = useMemo(() => {
    const logs = (workLogsQuery.data?.items ?? []).map((log) => ({
      date: log.date,
      taskId: log.taskId,
      title: log.task?.title ?? "—",
      hours: log.hours,
      reason: log.description,
    }));
    return groupAllocationsByDate(logs);
  }, [workLogsQuery.data]);

  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["attendance"] });
    await queryClient.invalidateQueries({ queryKey: ["work-logs"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("employeeTitle")}
        description={t("employeeDescription")}
        actions={
          <Button type="button" onClick={() => setSubmitOpen(true)}>
            {t("newAttendance")}
          </Button>
        }
      />

      {successMessage ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card size="sm">
          <CardHeader className="pb-0">
            <CardDescription>{t("statApprovedWeekHours")}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {weekStatsQuery.isLoading
                ? "—"
                : t("hoursValue", {
                    hours: weekStatsQuery.data?.approvedHours ?? 0,
                  })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader className="pb-0">
            <CardDescription>{t("statPendingRecords")}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {weekStatsQuery.isLoading
                ? "—"
                : t("pendingRecordsCount", {
                    count: weekStatsQuery.data?.pendingCount ?? 0,
                  })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("fullLogTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
                    <TableHead>{t("dayLabel")}</TableHead>
                    <TableHead>{t("clockInOutColumn")}</TableHead>
                    <TableHead>{t("netHoursColumn")}</TableHead>
                    <TableHead>{t("subtask")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recordsQuery.data.items.map((row) => {
                    const allocations = allocationsByDate.get(row.date) ?? [];
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          {formatDate(row.date, "dddd D MMMM")}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {timeRangeLabel(
                            row.clockIn,
                            row.clockOut,
                            row.breakMinutes,
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {row.totalHours != null
                            ? t("hoursValue", { hours: row.totalHours })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {allocations.length > 0 ? (
                            <ul className="flex flex-col gap-1">
                              {allocations.map((alloc, index) => (
                                <li
                                  key={`${row.id}-${alloc.kind}-${alloc.taskId ?? index}`}
                                >
                                  <span
                                    className={
                                      alloc.kind === "general"
                                        ? "inline-flex max-w-xs items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-950"
                                        : "inline-flex max-w-xs items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-900"
                                    }
                                  >
                                    <Link2 className="size-3 shrink-0 opacity-70" />
                                    <span className="truncate">
                                      {alloc.kind === "general"
                                        ? `${t("entryTypeGeneral")}: ${alloc.reason ?? "—"}`
                                        : alloc.title}
                                    </span>
                                    <span className="tabular-nums opacity-80">
                                      · {t("hoursValue", { hours: alloc.hours })}
                                    </span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              {t("generalTimeOnly")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={uiStateBadgeVariant(row.uiState)}>
                            {t(`uiState_${row.uiState}`)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {canEmployeeEditAttendance(row) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditRecord(row)}
                            >
                              {t("editAttendance")}
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePagination
                page={recordsQuery.data.page}
                pageSize={recordsQuery.data.pageSize as TablePageSize}
                total={recordsQuery.data.total}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("newAttendance")}</DialogTitle>
          </DialogHeader>
          {submitOpen ? (
            <AttendanceSubmitForm
              viewerId={viewerId}
              defaultDate={todayDate}
              submitLabel={t("saveAttendance")}
              onSuccess={async () => {
                setSuccessMessage(t("submitSuccess"));
                setSubmitOpen(false);
                await invalidateAll();
              }}
            />
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubmitOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AttendanceEditDialog
        open={Boolean(editRecord)}
        onOpenChange={(open) => {
          if (!open) setEditRecord(null);
        }}
        viewerId={viewerId}
        record={editRecord}
        onSuccess={async () => {
          setSuccessMessage(t("editSuccess"));
          await invalidateAll();
        }}
      />
    </div>
  );
}
