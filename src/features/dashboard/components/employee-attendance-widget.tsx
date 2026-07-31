"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarCheck, Clock, Link2 } from "lucide-react";

import type { DashboardAttendanceItem } from "@/features/dashboard/types/dashboard.types";
import type { AttendanceRecord } from "@/features/attendance/types/attendance.types";
import {
  AttendanceEditDialog,
  canEmployeeEditAttendance,
} from "@/features/attendance/components/attendance-edit-dialog";
import { AttendanceSubmitForm } from "@/features/attendance/components/attendance-submit-form";
import {
  calendarDateInOrgTimezone,
  orgLocalTimeOfDay,
} from "@/features/attendance/services/compute-hours";
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
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";

type EmployeeAttendanceWidgetProps = {
  viewerId: string;
  weekAttendance: DashboardAttendanceItem[];
  weekHours: number;
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

function timeRangeLabel(clockIn: string, clockOut: string | null): string {
  try {
    const start = orgLocalTimeOfDay(clockIn);
    if (!clockOut) return start;
    return `${start}-${orgLocalTimeOfDay(clockOut)}`;
  } catch {
    return "—";
  }
}

export function EmployeeAttendanceWidget({
  viewerId,
  weekAttendance,
  weekHours,
}: EmployeeAttendanceWidgetProps) {
  const t = useTranslations("dashboard");
  const tAtt = useTranslations("attendance");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);

  const todayQuery = useQuery({
    queryKey: ["attendance", "today"],
    queryFn: async () => {
      const response = await fetch("/api/attendance/today");
      return readApi<AttendanceRecord | null>(response);
    },
  });

  const today = todayQuery.data;
  const hasToday = Boolean(today);
  const todayDate = calendarDateInOrgTimezone();
  const canEditToday = today ? canEmployeeEditAttendance(today) : false;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="size-4 text-muted-foreground" />
            <CardTitle>{t("weekLogTitle")}</CardTitle>
          </div>
          <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-sm tabular-nums text-sky-800">
            {t("weekHoursLabel", { hours: weekHours })}
          </span>
        </CardHeader>
        <CardContent>
          {weekAttendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("weekLogEmpty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {weekAttendance.map((row) => (
                <li key={row.id} className="space-y-2 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {formatDate(row.date, "dddd D MMMM")}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {timeRangeLabel(row.clockIn, row.clockOut)}
                      </span>
                      <Badge variant={uiStateBadgeVariant(row.uiState)}>
                        {tAtt(`uiState_${row.uiState}`)}
                      </Badge>
                    </div>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {row.totalHours != null
                        ? t("hoursShort", { hours: row.totalHours })
                        : "—"}
                    </span>
                  </div>
                  {row.allocations.length > 0 ? (
                    <ul className="flex flex-col gap-1.5">
                      {row.allocations.map((alloc, index) => (
                        <li
                          key={`${row.id}-${alloc.kind}-${alloc.taskId ?? index}`}
                          className="flex items-center justify-between gap-2"
                        >
                          <span
                            className={
                              alloc.kind === "general"
                                ? "inline-flex min-w-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-950"
                                : "inline-flex min-w-0 items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs text-teal-900"
                            }
                          >
                            <Link2 className="size-3 shrink-0 opacity-70" />
                            <span className="truncate">
                              {alloc.kind === "general"
                                ? `${tAtt("entryTypeGeneral")}: ${alloc.reason ?? "—"}`
                                : alloc.title}
                            </span>
                            <span className="tabular-nums opacity-80">
                              · {t("hoursShort", { hours: alloc.hours })}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      {tAtt("generalTimeOnly")}
                    </p>
                  )}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            {t("clockWidgetTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {successMessage ? (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
              <AlertDescription>{successMessage}</AlertDescription>
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
    </div>
  );
}
