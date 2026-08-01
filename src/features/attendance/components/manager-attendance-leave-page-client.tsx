"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays, Clock3 } from "lucide-react";

import { EmployeeAttendancePageClient } from "@/features/attendance/components/employee-attendance-page-client";
import { AttendanceReviewDialog } from "@/features/attendance/components/attendance-review-dialog";
import { summarizeAllocations } from "@/features/attendance/components/attendance-display-utils";
import { TeamWeekSheet } from "@/features/attendance/components/team-week-sheet";
import type { AttendanceRecord } from "@/features/attendance/types/attendance.types";
import { EmployeeLeavePageClient } from "@/features/leave/components/employee-leave-page-client";
import type { LeaveRequest } from "@/features/leave/types/leave.types";
import type { Role } from "@/lib/permissions";
import { formatDate } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Tabs, TabPanel } from "@/components/shared/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  viewerRole?: Role;
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

function tabFromParam(param: string | null, isAdmin: boolean): string {
  if (isAdmin && (param === "mine" || param === "records" || param === "workLogs")) {
    return "approve";
  }
  if (param === "team" || param === "mine" || param === "approve") {
    return param;
  }
  if (param === "leave") return isAdmin ? "approve" : "mine";
  return "approve";
}

export function ManagerAttendanceLeavePageClient({
  viewerId,
  viewerRole,
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
  const isAdmin = viewerRole === "admin";

  const tab = tabFromParam(searchParams.get("tab"), isAdmin);
  const mineSection =
    searchParams.get("section") === "leave" ? "leave" : "attendance";

  const setTab = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "approve") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    if (value !== "mine") {
      params.delete("section");
    }
    const qs = params.toString();
    router.replace(qs ? `/attendance?${qs}` : "/attendance");
  };

  const setMineSection = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "mine");
    if (value === "attendance") {
      params.delete("section");
    } else {
      params.set("section", value);
    }
    const qs = params.toString();
    router.replace(qs ? `/attendance?${qs}` : "/attendance");
  };

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAllEmployees, setShowAllEmployees] = useState(false);
  const [reviewRecord, setReviewRecord] = useState<AttendanceRecord | null>(
    null,
  );
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const managersOnly = isAdmin && !showAllEmployees;
  const requesterRoleParam = managersOnly
    ? "department_manager"
    : undefined;

  const pendingAttendanceQuery = useQuery({
    queryKey: [
      "attendance",
      "manager-pending",
      requesterRoleParam ?? "all",
    ],
    enabled: tab === "approve" && canApproveAttendance,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50",
        awaitingApproval: "true",
        sortBy: "date",
        sortDir: "desc",
      });
      if (requesterRoleParam) {
        params.set("requesterRole", requesterRoleParam);
      }
      const response = await fetch(`/api/attendance?${params}`);
      return readApi<ListResult<AttendanceRecord>>(response);
    },
  });

  const pendingLeaveQuery = useQuery({
    queryKey: [
      "leave-requests",
      "manager-pending",
      requesterRoleParam ?? "all",
    ],
    enabled: tab === "approve" && canApproveLeave,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50",
        status: "pending",
      });
      if (requesterRoleParam) {
        params.set("requesterRole", requesterRoleParam);
      }
      const response = await fetch(`/api/leave-requests?${params}`);
      return readApi<ListResult<LeaveRequest>>(response);
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
    { id: "approve", label: t("tabApprove") },
    { id: "team", label: isAdmin ? t("tabOrg") : t("tabTeam") },
    ...(!isAdmin ? [{ id: "mine", label: t("tabMine") }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={
          isAdmin ? t("adminDescription") : t("managerDescription")
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
        <TabPanel when="approve" active={tab}>
          <div className="space-y-4">
            {isAdmin ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 rounded border"
                  checked={showAllEmployees}
                  onChange={(e) => setShowAllEmployees(e.target.checked)}
                />
                {t("showAllEmployees")}
              </label>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
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
                          <TableHead>{tApprovals("breakdown")}</TableHead>
                          <TableHead>{tApprovals("actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingAttendanceItems.map((row) => {
                          const breakdown = summarizeAllocations(row);
                          const generalReasonText =
                            breakdown.generalReasons.join(" · ");
                          return (
                            <TableRow key={row.id}>
                              <TableCell>{formatDate(row.date)}</TableCell>
                              <TableCell>
                                {row.user?.fullName ?? "—"}
                              </TableCell>
                              <TableCell>{row.totalHours ?? "—"}</TableCell>
                              <TableCell className="max-w-48">
                                <div className="text-sm">
                                  {tAttendance("allocationSummary", {
                                    allocated: breakdown.taskHours,
                                    remaining: breakdown.generalHours,
                                  })}
                                </div>
                                {generalReasonText ? (
                                  <p
                                    className="mt-0.5 truncate text-xs text-muted-foreground"
                                    title={generalReasonText}
                                  >
                                    {generalReasonText}
                                  </p>
                                ) : null}
                              </TableCell>
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
                          );
                        })}
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
                          <TableHead>{tApprovals("reason")}</TableHead>
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
                            <TableCell
                              className="max-w-40 truncate"
                              title={row.reason ?? undefined}
                            >
                              {row.reason ?? "—"}
                            </TableCell>
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
                                variant="destructive"
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
          </div>
        </TabPanel>

        <TabPanel when="team" active={tab}>
          <TeamWeekSheet
            onOpenRecord={setReviewRecord}
            preferManagersFilter={isAdmin}
          />
        </TabPanel>

        {!isAdmin ? (
          <TabPanel when="mine" active={tab}>
            <Tabs
              items={[
                { id: "attendance", label: t("tabMyAttendance") },
                { id: "leave", label: t("tabMyLeave") },
              ]}
              value={mineSection}
              onValueChange={setMineSection}
            >
              <TabPanel when="attendance" active={mineSection}>
                <EmployeeAttendancePageClient viewerId={viewerId} embedded />
              </TabPanel>
              <TabPanel when="leave" active={mineSection}>
                <EmployeeLeavePageClient viewerId={viewerId} embedded />
              </TabPanel>
            </Tabs>
          </TabPanel>
        ) : null}
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
            <textarea
              id="rejectReason"
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring/50 flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
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
