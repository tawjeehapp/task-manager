"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Clock } from "lucide-react";

import type { DashboardAttendanceItem } from "@/features/dashboard/types/dashboard.types";
import { deriveAttendanceActions } from "@/features/dashboard/lib/derive-attendance-actions";
import type { AttendanceRecord } from "@/features/attendance/types/attendance.types";
import {
  AttendanceEditDialog,
  canEmployeeEditAttendance,
} from "@/features/attendance/components/attendance-edit-dialog";
import { AttendanceSubmitForm } from "@/features/attendance/components/attendance-submit-form";
import { calendarDateInOrgTimezone } from "@/features/attendance/services/compute-hours";
import { formatDate, formatDateTime } from "@/lib/dates";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";

type EmployeeAttendanceWidgetProps = {
  viewerId: string;
  weekAttendance: DashboardAttendanceItem[];
};

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as {
    data?: T;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data as T;
}

function uiStateBadgeVariant(
  uiState: AttendanceRecord["uiState"],
): "default" | "secondary" | "destructive" | "outline" {
  if (uiState === "approved") return "default";
  if (uiState === "rejected") return "destructive";
  if (uiState === "currently_working") return "secondary";
  return "outline";
}

export function EmployeeAttendanceWidget({
  viewerId,
  weekAttendance,
}: EmployeeAttendanceWidgetProps) {
  const t = useTranslations("dashboard");
  const tAtt = useTranslations("attendance");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [missingDate, setMissingDate] = useState<string | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);

  const todayDate = calendarDateInOrgTimezone();
  const actions = useMemo(
    () =>
      deriveAttendanceActions({
        today: todayDate,
        weekAttendance,
      }),
    [todayDate, weekAttendance],
  );
  const actionCount = actions.rejected.length + actions.missingDates.length;

  const todayQuery = useQuery({
    queryKey: ["attendance", "today"],
    queryFn: async () => {
      const response = await fetch("/api/attendance/today");
      return readApi<AttendanceRecord | null>(response);
    },
  });

  const today = todayQuery.data;
  const hasToday = Boolean(today);
  const canEditToday = today ? canEmployeeEditAttendance(today) : false;

  async function openRejectedEdit(id: string) {
    setLoadingEditId(id);
    setFormErrorMessage(null);
    try {
      const response = await fetch(`/api/attendance/${id}`);
      const record = await readApi<AttendanceRecord>(response);
      setEditRecord(record);
    } catch (error) {
      setFormErrorMessage(
        error instanceof Error ? error.message : tCommon("errorTitle"),
      );
    } finally {
      setLoadingEditId(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            {t("clockWidgetTitle", { date: formatDate(todayDate) })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {successMessage ? (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          ) : null}
          {formErrorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{formErrorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {todayQuery.isLoading ? <LoadingState /> : null}
          {todayQuery.isError ? (
            <ErrorState
              title={tCommon("errorTitle")}
              description={(todayQuery.error as Error).message}
              onRetry={() => void todayQuery.refetch()}
            />
          ) : null}

          {!todayQuery.isLoading && !todayQuery.isError ? (
            <>
              {!hasToday ? (
                <AttendanceSubmitForm
                  viewerId={viewerId}
                  defaultDate={todayDate}
                  lockDate
                  onSuccess={() => {
                    setSuccessMessage(tAtt("submitSuccess"));
                    router.refresh();
                  }}
                />
              ) : today ? (
                <div className="space-y-3">
                  <Badge variant={uiStateBadgeVariant(today.uiState)}>
                    {tAtt(`uiState_${today.uiState}`)}
                  </Badge>
                  <p className="text-sm">
                    {tAtt("todaySummary", {
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
                      {tAtt("rejectionReason", {
                        reason: today.rejectionReason,
                      })}
                    </p>
                  ) : null}
                  {canEditToday ? (
                    <Button
                      variant="outline"
                      onClick={() => setEditRecord(today)}
                    >
                      {tAtt("editAttendance")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-muted-foreground" />
            <CardTitle>{t("attendanceActionsTitle")}</CardTitle>
          </div>
          {actionCount > 0 ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-sm tabular-nums text-amber-900">
              {t("attendanceActionsCount", { count: actionCount })}
            </span>
          ) : null}
        </CardHeader>
        <CardContent>
          {actionCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("attendanceActionsEmpty")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {actions.rejected.map((row) => (
                <li
                  key={`rejected-${row.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {formatDate(row.date, "dddd D MMMM")}
                      </span>
                      <Badge variant="destructive">
                        {tAtt("uiState_rejected")}
                      </Badge>
                    </div>
                    {row.rejectionReason ? (
                      <p className="text-destructive text-xs">
                        {tAtt("rejectionReason", {
                          reason: row.rejectionReason,
                        })}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loadingEditId === row.id}
                    onClick={() => void openRejectedEdit(row.id)}
                  >
                    {tAtt("correctAndResubmit")}
                  </Button>
                </li>
              ))}
              {actions.missingDates.map((date) => (
                <li
                  key={`missing-${date}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {formatDate(date, "dddd D MMMM")}
                    </span>
                    <Badge variant="outline">
                      {t("attendanceActionMissing")}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMissingDate(date)}
                  >
                    {t("attendanceActionRecord")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/attendance"
            className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            {t("viewAttendance")}
          </Link>
        </CardContent>
      </Card>

      <AttendanceEditDialog
        open={Boolean(editRecord)}
        onOpenChange={(open) => {
          if (!open) setEditRecord(null);
        }}
        viewerId={viewerId}
        record={editRecord}
        onSuccess={() => {
          setSuccessMessage(tAtt("editSuccess"));
          void todayQuery.refetch();
          router.refresh();
        }}
      />

      <Dialog
        open={Boolean(missingDate)}
        onOpenChange={(open) => {
          if (!open) setMissingDate(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {missingDate
                ? t("attendanceActionRecordTitle", {
                    date: formatDate(missingDate, "dddd D MMMM"),
                  })
                : t("attendanceActionRecord")}
            </DialogTitle>
          </DialogHeader>
          {missingDate ? (
            <AttendanceSubmitForm
              key={missingDate}
              viewerId={viewerId}
              defaultDate={missingDate}
              lockDate
              onSuccess={() => {
                setMissingDate(null);
                setSuccessMessage(tAtt("submitSuccess"));
                router.refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
