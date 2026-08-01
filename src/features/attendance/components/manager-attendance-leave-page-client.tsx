"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays, Clock3, Inbox, List, UserRound } from "lucide-react";

import { EmployeeAttendancePageClient } from "@/features/attendance/components/employee-attendance-page-client";
import { AttendanceReviewDialog } from "@/features/attendance/components/attendance-review-dialog";
import type { AttendanceRecord } from "@/features/attendance/types/attendance.types";
import { EmployeeLeavePageClient } from "@/features/leave/components/employee-leave-page-client";
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

type ManagerAttendanceLeavePageClientProps = {
  viewerId: string;
  canApproveAttendance: boolean;
  canApproveLeave: boolean;
};

type ListResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type RejectTarget =
  | { kind: "attendance"; id: string }
  | { kind: "leave"; id: string };

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

function tabFromParam(param: string | null): string {
  if (param === "team" || param === "mine" || param === "approve") {
    return param;
  }
  if (param === "leave") return "mine";
  return "approve";
}

export function ManagerAttendanceLeavePageClient({
  viewerId,
  canApproveAttendance,
  canApproveLeave,
}: ManagerAttendanceLeavePageClientProps) {
  const t = useTranslations("attendanceLeave");
  const tAttendance = useTranslations("attendance");
  const tApprovals = useTranslations("approvals");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tab = tabFromParam(searchParams.get("tab"));
  const setTab = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "approve") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const qs = params.toString();
    router.replace(qs ? `/attendance?${qs}` : "/attendance");
  };

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewRecord, setReviewRecord] = useState<AttendanceRecord | null>(
    null,
  );
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [teamPage, setTeamPage] = useState(1);
  const [teamPageSize, setTeamPageSize] =
    useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const pendingAttendanceQuery = useQuery({
    queryKey: ["attendance", "manager-pending"],
    enabled: tab === "approve" && canApproveAttendance,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50",
        awaitingApproval: "true",
        sortBy: "date",
        sortDir: "desc",
      });
      const response = await fetch(`/api/attendance?${params}`);
      return readApi<ListResult<AttendanceRecord>>(response);
    },
  });

  const pendingLeaveQuery = useQuery({
    queryKey: ["leave-requests", "manager-pending"],
    enabled: tab === "approve" && canApproveLeave,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50",
        status: "pending",
      });
      const response = await fetch(`/api/leave-requests?${params}`);
      return readApi<ListResult<LeaveRequest>>(response);
    },
  });

  const teamQuery = useQuery({
    queryKey: [
      "attendance",
      "team-sheet",
      teamPage,
      teamPageSize,
      dateFrom,
      dateTo,
      statusFilter,
    ],
    enabled: tab === "team",
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(teamPage),
        pageSize: String(teamPageSize),
        sortBy: "date",
        sortDir: "desc",
      });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (statusFilter) params.set("status", statusFilter);
      const response = await fetch(`/api/attendance?${params}`);
      return readApi<ListResult<AttendanceRecord>>(response);
    },
  });

  const pendingAttendanceItems = useMemo(
    () =>
      (pendingAttendanceQuery.data?.items ?? []).filter(
        (row) => row.userId !== viewerId,
      ),
    [pendingAttendanceQuery.data, viewerId],
  );

  const approveAttendanceMutation = useMutation({
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
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const approveLeaveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/leave-requests/${id}/approve`, {
        method: "POST",
      });
      return readApi(response);
    },
    onSuccess: async () => {
      setSuccessMessage(tApprovals("approveSuccess"));
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectTarget) return;
      const path =
        rejectTarget.kind === "attendance"
          ? `/api/attendance/${rejectTarget.id}/reject`
          : `/api/leave-requests/${rejectTarget.id}/reject`;
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      return readApi(response);
    },
    onSuccess: async () => {
      setSuccessMessage(tApprovals("rejectSuccess"));
      setActionError(null);
      setRejectTarget(null);
      setRejectReason("");
      setReviewRecord(null);
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
      await queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const tabs = [
    {
      id: "approve",
      label: t("tabApprove"),
      icon: Inbox,
    },
    {
      id: "team",
      label: t("tabTeam"),
      icon: List,
    },
    {
      id: "mine",
      label: t("tabMine"),
      icon: UserRound,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("managerDescription")} />

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
        items={tabs.map(({ id, label }) => ({ id, label }))}
        value={tab}
        onValueChange={setTab}
      >
        <TabPanel when="approve" active={tab}>
          <div className="space-y-4">
            {canApproveAttendance ? (
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-0.5 size-5 text-muted-foreground" />
                    <div>
                      <CardTitle>{t("pendingHoursTitle")}</CardTitle>
                      <CardDescription>
                        {t("pendingHoursCount", {
                          count: pendingAttendanceItems.length,
                        })}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {pendingAttendanceQuery.isLoading ? <LoadingState /> : null}
                  {pendingAttendanceQuery.isError ? (
                    <ErrorState
                      title={tCommon("errorTitle")}
                      onRetry={() => void pendingAttendanceQuery.refetch()}
                    />
                  ) : null}
                  {pendingAttendanceQuery.data &&
                  pendingAttendanceItems.length === 0 ? (
                    <EmptyState
                      title={t("pendingHoursEmptyTitle")}
                      description={t("pendingHoursEmptyDescription")}
                    />
                  ) : null}
                  {pendingAttendanceItems.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tApprovals("date")}</TableHead>
                          <TableHead>{tApprovals("employee")}</TableHead>
                          <TableHead>{tApprovals("totalHours")}</TableHead>
                          <TableHead>{tApprovals("actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingAttendanceItems.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{formatDate(row.date)}</TableCell>
                            <TableCell>{row.user?.fullName ?? "—"}</TableCell>
                            <TableCell>{row.totalHours ?? "—"}</TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => setReviewRecord(row)}
                              >
                                {tAttendance("review")}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {canApproveLeave ? (
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <CalendarDays className="mt-0.5 size-5 text-muted-foreground" />
                    <div>
                      <CardTitle>{t("pendingLeaveTitle")}</CardTitle>
                      <CardDescription>
                        {t("pendingLeaveCount", {
                          count: pendingLeaveQuery.data?.total ?? 0,
                        })}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {pendingLeaveQuery.isLoading ? <LoadingState /> : null}
                  {pendingLeaveQuery.isError ? (
                    <ErrorState
                      title={tCommon("errorTitle")}
                      onRetry={() => void pendingLeaveQuery.refetch()}
                    />
                  ) : null}
                  {pendingLeaveQuery.data &&
                  pendingLeaveQuery.data.items.length === 0 ? (
                    <EmptyState
                      title={t("pendingLeaveEmptyTitle")}
                      description={t("pendingLeaveEmptyDescription")}
                    />
                  ) : null}
                  {pendingLeaveQuery.data &&
                  pendingLeaveQuery.data.items.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tApprovals("employee")}</TableHead>
                          <TableHead>{tApprovals("leaveType")}</TableHead>
                          <TableHead>{tApprovals("dates")}</TableHead>
                          <TableHead>{tApprovals("days")}</TableHead>
                          <TableHead>{tApprovals("actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingLeaveQuery.data.items.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.user?.fullName ?? "—"}</TableCell>
                            <TableCell>
                              {row.leaveType?.name ?? "—"}
                            </TableCell>
                            <TableCell>
                              {formatDate(row.startDate)} –{" "}
                              {formatDate(row.endDate)}
                            </TableCell>
                            <TableCell>{row.days}</TableCell>
                            <TableCell className="space-x-2 space-x-reverse">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() =>
                                  approveLeaveMutation.mutate(row.id)
                                }
                              >
                                {tApprovals("approve")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setRejectTarget({
                                    kind: "leave",
                                    id: row.id,
                                  })
                                }
                              >
                                {tApprovals("reject")}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </TabPanel>

        <TabPanel when="team" active={tab}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1">
                <Label htmlFor="teamDateFrom">{tAttendance("dateFrom")}</Label>
                <Input
                  id="teamDateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setTeamPage(1);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="teamDateTo">{tAttendance("dateTo")}</Label>
                <Input
                  id="teamDateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setTeamPage(1);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="teamStatus">{tAttendance("status")}</Label>
                <select
                  id="teamStatus"
                  className="flex h-9 w-full min-w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setTeamPage(1);
                  }}
                >
                  <option value="">{t("filterAll")}</option>
                  <option value="pending">
                    {tAttendance("status_pending")}
                  </option>
                  <option value="approved">
                    {tAttendance("status_approved")}
                  </option>
                  <option value="rejected">
                    {tAttendance("status_rejected")}
                  </option>
                </select>
              </div>
            </div>

            {teamQuery.isLoading ? <LoadingState /> : null}
            {teamQuery.isError ? (
              <ErrorState
                title={tCommon("errorTitle")}
                onRetry={() => void teamQuery.refetch()}
              />
            ) : null}
            {teamQuery.data && teamQuery.data.items.length === 0 ? (
              <EmptyState
                title={tAttendance("recordsEmptyTitle")}
                description={tAttendance("recordsEmptyDescription")}
              />
            ) : null}
            {teamQuery.data && teamQuery.data.items.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tAttendance("dayLabel")}</TableHead>
                      <TableHead>{tAttendance("employee")}</TableHead>
                      <TableHead>{tAttendance("entryTime")}</TableHead>
                      <TableHead>{tAttendance("exitTime")}</TableHead>
                      <TableHead>{tAttendance("totalHours")}</TableHead>
                      <TableHead>{tAttendance("status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamQuery.data.items.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatDate(row.date)}</TableCell>
                        <TableCell>{row.user?.fullName ?? "—"}</TableCell>
                        <TableCell>
                          {row.clockIn
                            ? new Date(row.clockIn).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {row.clockOut
                            ? new Date(row.clockOut).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </TableCell>
                        <TableCell>{row.totalHours ?? "—"}</TableCell>
                        <TableCell>
                          {tAttendance(`status_${row.status}` as never)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  page={teamQuery.data.page}
                  pageSize={teamPageSize}
                  total={teamQuery.data.total}
                  onPageChange={setTeamPage}
                  onPageSizeChange={(size) => {
                    setTeamPageSize(size);
                    setTeamPage(1);
                  }}
                />
              </>
            ) : null}
          </div>
        </TabPanel>

        <TabPanel when="mine" active={tab}>
          <div className="space-y-10">
            <EmployeeAttendancePageClient viewerId={viewerId} embedded />
            <EmployeeLeavePageClient viewerId={viewerId} embedded />
          </div>
        </TabPanel>
      </Tabs>

      <AttendanceReviewDialog
        record={reviewRecord}
        open={!!reviewRecord}
        onOpenChange={(open) => {
          if (!open) setReviewRecord(null);
        }}
        isApproving={approveAttendanceMutation.isPending}
        onApprove={(id) => approveAttendanceMutation.mutate(id)}
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
            <Label htmlFor="rejectReason">
              {tApprovals("rejectionReasonLabel")}
            </Label>
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
