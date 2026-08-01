"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, Clock3, ClipboardList, FolderKanban } from "lucide-react";

import { AttendanceReviewDialog } from "@/features/attendance/components/attendance-review-dialog";
import { summarizeAllocations } from "@/features/attendance/components/attendance-display-utils";
import type { AttendanceRecord } from "@/features/attendance/types/attendance.types";
import type { ProjectMember } from "@/features/projects/types/project.types";
import type { EmployeeRequest } from "@/features/employee-requests/types/employee-request.types";
import type { ProjectRequest } from "@/features/project-requests/types/project-request.types";
import type { LeaveRequest } from "@/features/leave/types/leave.types";
import { formatDate } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
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
  DialogDescription,
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
  viewerId: string;
  canApproveLeave: boolean;
  canApproveEmployeeRequest: boolean;
  canApproveAttendance: boolean;
  canApproveProjectRequest: boolean;
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
  | { kind: "employee"; id: string }
  | { kind: "attendance"; id: string }
  | { kind: "project"; id: string };

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
  viewerId,
  canApproveLeave,
  canApproveEmployeeRequest,
  canApproveAttendance,
  canApproveProjectRequest,
}: ApprovalsPageClientProps) {
  const t = useTranslations("approvals");
  const tAttendance = useTranslations("attendance");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewRecord, setReviewRecord] = useState<AttendanceRecord | null>(
    null,
  );
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [excusalTarget, setExcusalTarget] = useState<EmployeeRequest | null>(
    null,
  );
  const [excusalAssigneeId, setExcusalAssigneeId] = useState("");

  const leaveQuery = useQuery({
    queryKey: ["approvals-leave"],
    enabled: canApproveLeave,
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

  const attendanceQuery = useQuery({
    queryKey: ["approvals-attendance"],
    enabled: canApproveAttendance,
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

  const extensionsQuery = useQuery({
    queryKey: ["approvals-extensions"],
    enabled: canApproveEmployeeRequest,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50",
        status: "pending",
        type: "extension",
      });
      const response = await fetch(`/api/employee-requests?${params}`);
      return readApi<ListResult<EmployeeRequest>>(response);
    },
  });

  const excusalsQuery = useQuery({
    queryKey: ["approvals-excusals"],
    enabled: canApproveEmployeeRequest,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50",
        status: "pending",
        type: "excusal",
      });
      const response = await fetch(`/api/employee-requests?${params}`);
      return readApi<ListResult<EmployeeRequest>>(response);
    },
  });

  const projectExtensionsQuery = useQuery({
    queryKey: ["approvals-project-extensions"],
    enabled: canApproveProjectRequest,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50",
        status: "pending",
        type: "extension",
      });
      const response = await fetch(`/api/project-requests?${params}`);
      return readApi<ListResult<ProjectRequest>>(response);
    },
  });

  const attendanceItems = useMemo(
    () =>
      (attendanceQuery.data?.items ?? []).filter(
        (row) => row.userId !== viewerId,
      ),
    [attendanceQuery.data, viewerId],
  );

  const taskItems = useMemo(() => {
    const extensions = extensionsQuery.data?.items ?? [];
    const excusals = excusalsQuery.data?.items ?? [];
    return [...extensions, ...excusals].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }, [extensionsQuery.data, excusalsQuery.data]);

  const projectItems = projectExtensionsQuery.data?.items ?? [];

  const totalPending =
    (canApproveLeave ? (leaveQuery.data?.total ?? 0) : 0) +
    (canApproveAttendance ? attendanceItems.length : 0) +
    (canApproveEmployeeRequest ? taskItems.length : 0) +
    (canApproveProjectRequest ? projectItems.length : 0);

  const projectMembersQuery = useQuery({
    queryKey: ["project-members", excusalTarget?.projectId],
    enabled: Boolean(excusalTarget?.projectId),
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${excusalTarget!.projectId}/members`,
      );
      const data = await readApi<{ items: ProjectMember[] }>(response);
      return data.items;
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
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const approveAttendanceMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/attendance/${id}/approve`, {
        method: "POST",
      });
      return readApi(response);
    },
    onSuccess: async () => {
      setSuccessMessage(t("approveSuccess"));
      setActionError(null);
      setReviewRecord(null);
      await queryClient.invalidateQueries({ queryKey: ["approvals-attendance"] });
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const approveEmployeeMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      assignedTo?: string;
    }) => {
      const response = await fetch(
        `/api/employee-requests/${payload.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            payload.assignedTo !== undefined
              ? { assignedTo: payload.assignedTo }
              : {},
          ),
        },
      );
      return readApi(response);
    },
    onSuccess: async () => {
      setSuccessMessage(t("approveSuccess"));
      setActionError(null);
      setExcusalTarget(null);
      setExcusalAssigneeId("");
      await queryClient.invalidateQueries({ queryKey: ["approvals-extensions"] });
      await queryClient.invalidateQueries({ queryKey: ["approvals-excusals"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const approveProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/project-requests/${id}/approve`, {
        method: "POST",
      });
      return readApi(response);
    },
    onSuccess: async () => {
      setSuccessMessage(t("approveSuccess"));
      setActionError(null);
      await queryClient.invalidateQueries({
        queryKey: ["approvals-project-extensions"],
      });
      await queryClient.invalidateQueries({ queryKey: ["approvals-extensions"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectTarget) return;
      const path =
        rejectTarget.kind === "leave"
          ? `/api/leave-requests/${rejectTarget.id}/reject`
          : rejectTarget.kind === "attendance"
            ? `/api/attendance/${rejectTarget.id}/reject`
            : rejectTarget.kind === "project"
              ? `/api/project-requests/${rejectTarget.id}/reject`
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
      setReviewRecord(null);
      await queryClient.invalidateQueries({ queryKey: ["approvals-leave"] });
      await queryClient.invalidateQueries({ queryKey: ["approvals-attendance"] });
      await queryClient.invalidateQueries({ queryKey: ["approvals-extensions"] });
      await queryClient.invalidateQueries({ queryKey: ["approvals-excusals"] });
      await queryClient.invalidateQueries({
        queryKey: ["approvals-project-extensions"],
      });
      await queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const taskLoading =
    canApproveEmployeeRequest &&
    (extensionsQuery.isLoading || excusalsQuery.isLoading);
  const taskError =
    canApproveEmployeeRequest &&
    (extensionsQuery.isError || excusalsQuery.isError);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={
          totalPending === 0 ? t("descriptionEmpty") : t("description")
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

      <div className="grid gap-4">
        {canApproveEmployeeRequest ? (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <ClipboardList className="mt-0.5 size-5 text-muted-foreground" />
                <div>
                  <CardTitle>{t("cardTaskRequests")}</CardTitle>
                  <CardDescription>
                    {t("requestCount", { count: taskItems.length })}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {taskLoading ? <LoadingState /> : null}
              {taskError ? (
                <ErrorState
                  title={tCommon("errorTitle")}
                  onRetry={() => {
                    void extensionsQuery.refetch();
                    void excusalsQuery.refetch();
                  }}
                />
              ) : null}
              {!taskLoading && !taskError && taskItems.length === 0 ? (
                <EmptyState title={t("cardTaskRequestsEmpty")} />
              ) : null}
              {taskItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("employee")}</TableHead>
                      <TableHead>{t("task")}</TableHead>
                      <TableHead>{t("requestedDate")}</TableHead>
                      <TableHead>{t("reason")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taskItems.map((row) => {
                      const blockedByProjectEnd =
                        row.type === "extension" &&
                        Boolean(row.requestedDate) &&
                        Boolean(row.projectEndDate) &&
                        (row.requestedDate as string) >
                          (row.projectEndDate as string);
                      return (
                      <TableRow key={row.id}>
                        <TableCell>{row.user?.fullName ?? "—"}</TableCell>
                        <TableCell>{row.taskTitle ?? "—"}</TableCell>
                        <TableCell>
                          {row.requestedDate
                            ? formatDate(row.requestedDate)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <span>{row.reason ?? "—"}</span>
                            {blockedByProjectEnd ? (
                              <p className="text-xs text-amber-700 dark:text-amber-400">
                                {t("extensionNeedsProjectEnd", {
                                  date: formatDate(row.projectEndDate!),
                                })}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="space-x-2 space-x-reverse">
                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              blockedByProjectEnd ||
                              approveEmployeeMutation.isPending
                            }
                            title={
                              blockedByProjectEnd
                                ? t("extensionNeedsProjectEnd", {
                                    date: formatDate(row.projectEndDate!),
                                  })
                                : undefined
                            }
                            onClick={() => {
                              if (row.type === "excusal") {
                                setExcusalAssigneeId(viewerId);
                                setExcusalTarget(row);
                                return;
                              }
                              approveEmployeeMutation.mutate({ id: row.id });
                            }}
                          >
                            {t("approve")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              setRejectTarget({ kind: "employee", id: row.id })
                            }
                          >
                            {t("reject")}
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

        {canApproveProjectRequest ? (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <FolderKanban className="mt-0.5 size-5 text-muted-foreground" />
                <div>
                  <CardTitle>{t("cardProjectExtensions")}</CardTitle>
                  <CardDescription>
                    {t("requestCount", { count: projectItems.length })}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {projectExtensionsQuery.isLoading ? <LoadingState /> : null}
              {projectExtensionsQuery.isError ? (
                <ErrorState
                  title={tCommon("errorTitle")}
                  onRetry={() => void projectExtensionsQuery.refetch()}
                />
              ) : null}
              {!projectExtensionsQuery.isLoading &&
              !projectExtensionsQuery.isError &&
              projectItems.length === 0 ? (
                <EmptyState title={t("cardProjectExtensionsEmpty")} />
              ) : null}
              {projectItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("requester")}</TableHead>
                      <TableHead>{t("project")}</TableHead>
                      <TableHead>{t("currentEndDate")}</TableHead>
                      <TableHead>{t("requestedDate")}</TableHead>
                      <TableHead>{t("reason")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectItems.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.user?.fullName ?? "—"}</TableCell>
                        <TableCell>{row.projectName ?? "—"}</TableCell>
                        <TableCell>
                          {row.projectEndDate
                            ? formatDate(row.projectEndDate)
                            : "—"}
                        </TableCell>
                        <TableCell>{formatDate(row.requestedDate)}</TableCell>
                        <TableCell>{row.reason ?? "—"}</TableCell>
                        <TableCell className="space-x-2 space-x-reverse">
                          <Button
                            type="button"
                            size="sm"
                            disabled={approveProjectMutation.isPending}
                            onClick={() =>
                              approveProjectMutation.mutate(row.id)
                            }
                          >
                            {t("approve")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              setRejectTarget({ kind: "project", id: row.id })
                            }
                          >
                            {t("reject")}
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

        <div className="grid gap-4 md:grid-cols-2">
          {canApproveLeave ? (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 size-5 text-muted-foreground" />
                  <div>
                    <CardTitle>{t("cardLeave")}</CardTitle>
                    <CardDescription>
                      {t("requestCount", {
                        count: leaveQuery.data?.total ?? 0,
                      })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {leaveQuery.isLoading ? <LoadingState /> : null}
                {leaveQuery.isError ? (
                  <ErrorState
                    title={tCommon("errorTitle")}
                    onRetry={() => void leaveQuery.refetch()}
                  />
                ) : null}
                {leaveQuery.data && leaveQuery.data.items.length === 0 ? (
                  <EmptyState title={t("cardLeaveEmpty")} />
                ) : null}
                {leaveQuery.data && leaveQuery.data.items.length > 0 ? (
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
                              {t("approve")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
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
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {canApproveAttendance ? (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 size-5 text-muted-foreground" />
                  <div>
                    <CardTitle>{t("cardHours")}</CardTitle>
                    <CardDescription>
                      {t("requestCount", { count: attendanceItems.length })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {attendanceQuery.isLoading ? <LoadingState /> : null}
                {attendanceQuery.isError ? (
                  <ErrorState
                    title={tCommon("errorTitle")}
                    onRetry={() => void attendanceQuery.refetch()}
                  />
                ) : null}
                {attendanceQuery.data && attendanceItems.length === 0 ? (
                  <EmptyState title={t("cardHoursEmpty")} />
                ) : null}
                {attendanceItems.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("date")}</TableHead>
                        <TableHead>{t("employee")}</TableHead>
                        <TableHead>{t("totalHours")}</TableHead>
                        <TableHead>{t("breakdown")}</TableHead>
                        <TableHead>{t("actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceItems.map((row) => {
                        const breakdown = summarizeAllocations(row);
                        const generalReasonText =
                          breakdown.generalReasons.join(" · ");
                        return (
                          <TableRow key={row.id}>
                            <TableCell>{formatDate(row.date)}</TableCell>
                            <TableCell>{row.user?.fullName ?? "—"}</TableCell>
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
        </div>
      </div>

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
        open={!!excusalTarget}
        onOpenChange={(open) => {
          if (!open) {
            setExcusalTarget(null);
            setExcusalAssigneeId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("approveExcusalTitle")}</DialogTitle>
            <DialogDescription>
              {t("approveExcusalDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="excusalAssignee">{t("reassignRequired")}</Label>
            <select
              id="excusalAssignee"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={excusalAssigneeId}
              onChange={(event) => setExcusalAssigneeId(event.target.value)}
              disabled={projectMembersQuery.isLoading}
              required
            >
              {(() => {
                const members = (projectMembersQuery.data ?? []).filter(
                  (member) => member.userId !== excusalTarget?.userId,
                );
                const hasViewer = members.some(
                  (member) => member.userId === viewerId,
                );
                return (
                  <>
                    {!hasViewer && viewerId !== excusalTarget?.userId ? (
                      <option value={viewerId}>{t("reassignToMe")}</option>
                    ) : null}
                    {members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.userId === viewerId
                          ? t("reassignToMe")
                          : (member.user?.fullName ?? member.userId)}
                      </option>
                    ))}
                  </>
                );
              })()}
            </select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setExcusalTarget(null);
                setExcusalAssigneeId("");
              }}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={
                approveEmployeeMutation.isPending || !excusalAssigneeId
              }
              onClick={() => {
                if (!excusalTarget || !excusalAssigneeId) return;
                approveEmployeeMutation.mutate({
                  id: excusalTarget.id,
                  assignedTo: excusalAssigneeId,
                });
              }}
            >
              {t("approve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
