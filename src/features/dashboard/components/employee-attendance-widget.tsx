"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarCheck } from "lucide-react";

import type { DashboardAttendanceItem } from "@/features/dashboard/types/dashboard.types";
import type { AttendanceRecord } from "@/features/attendance/types/attendance.types";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";

type EmployeeAttendanceWidgetProps = {
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

export function EmployeeAttendanceWidget({
  weekAttendance,
  weekHours,
}: EmployeeAttendanceWidgetProps) {
  const t = useTranslations("dashboard");
  const tAtt = useTranslations("attendance");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const todayQuery = useQuery({
    queryKey: ["attendance", "today"],
    queryFn: async () => {
      const response = await fetch("/api/attendance/today");
      return readApi<AttendanceRecord | null>(response);
    },
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["attendance"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const clockInMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/attendance/clock-in", {
        method: "POST",
      });
      return readApi<AttendanceRecord>(response);
    },
    onSuccess: async () => {
      setActionError(null);
      setSuccessMessage(tAtt("clockInSuccess"));
      await invalidate();
    },
    onError: (error: Error) => {
      setSuccessMessage(null);
      setActionError(error.message);
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/attendance/clock-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          breakMinutes: Number(breakMinutes) || 0,
        }),
      });
      return readApi<AttendanceRecord>(response);
    },
    onSuccess: async () => {
      setActionError(null);
      setSuccessMessage(tAtt("clockOutSuccess"));
      await invalidate();
    },
    onError: (error: Error) => {
      setSuccessMessage(null);
      setActionError(error.message);
    },
  });

  const today = todayQuery.data;
  const isWorking = today?.uiState === "currently_working";
  const hasToday = Boolean(today);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="size-4 text-muted-foreground" />
            <CardTitle>{t("weekLogTitle")}</CardTitle>
          </div>
          <span className="text-sm tabular-nums text-muted-foreground">
            {t("weekHoursLabel", { hours: weekHours })}
          </span>
        </CardHeader>
        <CardContent>
          {weekAttendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("weekLogEmpty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {weekAttendance.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span>{formatDate(row.date)}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {row.totalHours != null
                      ? t("hoursValue", { hours: row.totalHours })
                      : isWorking && row.clockOut == null
                        ? tAtt("uiState_currently_working")
                        : "—"}
                  </span>
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
          <CardTitle>{t("clockWidgetTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {todayQuery.isLoading ? <LoadingState /> : null}
          {todayQuery.isError ? (
            <ErrorState
              title={tCommon("errorTitle")}
              description={(todayQuery.error as Error).message}
              onRetry={() => void todayQuery.refetch()}
            />
          ) : null}

          {!todayQuery.isLoading && !todayQuery.isError ? (
            <div className="space-y-3">
              {!hasToday ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {tAtt("notClockedIn")}
                  </p>
                  <Button
                    onClick={() => clockInMutation.mutate()}
                    disabled={clockInMutation.isPending}
                  >
                    {tAtt("clockIn")}
                  </Button>
                </>
              ) : null}

              {isWorking && today ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={uiStateBadgeVariant(today.uiState)}>
                      {tAtt(`uiState_${today.uiState}`)}
                    </Badge>
                    <span className="text-sm">
                      {tAtt("clockedInAt", {
                        time: formatDateTime(today.clockIn),
                      })}
                    </span>
                  </div>
                  <div className="max-w-xs space-y-2">
                    <Label htmlFor="dashBreakMinutes">
                      {tAtt("breakMinutes")}
                    </Label>
                    <Input
                      id="dashBreakMinutes"
                      type="number"
                      min={0}
                      value={breakMinutes}
                      onChange={(e) => setBreakMinutes(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={() => clockOutMutation.mutate()}
                    disabled={clockOutMutation.isPending}
                  >
                    {tAtt("clockOut")}
                  </Button>
                </>
              ) : null}

              {today && !isWorking ? (
                <div className="space-y-2">
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
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
