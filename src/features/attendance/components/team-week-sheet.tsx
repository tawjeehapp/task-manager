"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, List, Plane } from "lucide-react";

import { summarizeAllocations } from "@/features/attendance/components/attendance-display-utils";
import type { AttendanceRecord } from "@/features/attendance/types/attendance.types";
import type { LeaveRequest } from "@/features/leave/types/leave.types";
import type { UsersListResult } from "@/features/users/types/user.types";
import {
  shiftFocusDate,
  weekDays,
} from "@/features/dashboard/lib/calendar-range";
import { calendarDateInOrgTimezone } from "@/features/attendance/services/compute-hours";
import { formatDate } from "@/lib/dates";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ListResult<T> = {
  items: T[];
  total: number;
};

type TeamWeekSheetProps = {
  onOpenRecord: (record: AttendanceRecord) => void;
  /** When true (admin), default to department managers with a show-all toggle. */
  preferManagersFilter?: boolean;
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

function overlapsDay(leave: LeaveRequest, day: string): boolean {
  return leave.startDate <= day && leave.endDate >= day;
}

function statusDotClass(status: AttendanceRecord["status"]): string {
  if (status === "approved") return "bg-emerald-500";
  if (status === "rejected") return "bg-destructive";
  return "bg-amber-500";
}

function hoursTextClass(status: AttendanceRecord["status"]): string {
  if (status === "approved") return "text-emerald-700 dark:text-emerald-400";
  if (status === "rejected") return "text-destructive";
  return "text-amber-700 dark:text-amber-400";
}

function memberInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0) : "?";
}

export function TeamWeekSheet({
  onOpenRecord,
  preferManagersFilter = false,
}: TeamWeekSheetProps) {
  const t = useTranslations("attendanceLeave");
  const tCommon = useTranslations("common");
  const today = calendarDateInOrgTimezone();
  const [focusDate, setFocusDate] = useState(today);
  const [showAllEmployees, setShowAllEmployees] = useState(false);
  const days = useMemo(() => weekDays(focusDate), [focusDate]);
  const weekStart = days[0]!;
  const weekEnd = days[6]!;

  const managersOnly = preferManagersFilter && !showAllEmployees;
  const membersRoleScope = managersOnly ? "department_manager" : "all";

  const membersQuery = useQuery({
    queryKey: ["users", "team-week", membersRoleScope],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
        isActive: "true",
        sortBy: "fullName",
        sortDir: "asc",
      });
      if (managersOnly) {
        params.set("role", "department_manager");
      }
      const response = await fetch(`/api/users?${params}`);
      return readApi<UsersListResult>(response);
    },
  });

  const attendanceQuery = useQuery({
    queryKey: ["attendance", "team-week", weekStart, weekEnd],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
        dateFrom: weekStart,
        dateTo: weekEnd,
        sortBy: "date",
        sortDir: "asc",
        includeAllocations: "true",
      });
      const response = await fetch(`/api/attendance?${params}`);
      return readApi<ListResult<AttendanceRecord>>(response);
    },
  });

  const leaveQuery = useQuery({
    queryKey: ["leave-requests", "team-week", weekStart, weekEnd],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
        status: "approved",
        sortBy: "start_date",
        sortDir: "asc",
      });
      const response = await fetch(`/api/leave-requests?${params}`);
      return readApi<ListResult<LeaveRequest>>(response);
    },
  });

  const attendanceByUserDay = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const row of attendanceQuery.data?.items ?? []) {
      map.set(`${row.userId}:${row.date}`, row);
    }
    return map;
  }, [attendanceQuery.data]);

  const leaveByUser = useMemo(() => {
    const map = new Map<string, LeaveRequest[]>();
    const weekLeaves = (leaveQuery.data?.items ?? []).filter(
      (row) => row.startDate <= weekEnd && row.endDate >= weekStart,
    );
    for (const row of weekLeaves) {
      const list = map.get(row.userId) ?? [];
      list.push(row);
      map.set(row.userId, list);
    }
    return map;
  }, [leaveQuery.data, weekStart, weekEnd]);

  const members = membersQuery.data?.items ?? [];
  const isLoading =
    membersQuery.isLoading ||
    attendanceQuery.isLoading ||
    leaveQuery.isLoading;
  const isError =
    membersQuery.isError || attendanceQuery.isError || leaveQuery.isError;

  const rangeLabel = `${formatDate(weekStart, "D MMMM")} – ${formatDate(weekEnd, "D MMMM")}`;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <List className="size-5 text-muted-foreground" />
            <CardTitle>{t("weekSheetTitle")}</CardTitle>
          </div>
          {preferManagersFilter ? (
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
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFocusDate(shiftFocusDate("week", focusDate, -1))}
          >
            <ChevronRight className="size-4" />
            {t("weekPrevious")}
          </Button>
          <span className="min-w-40 text-center text-sm font-medium tabular-nums">
            {rangeLabel}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFocusDate(shiftFocusDate("week", focusDate, 1))}
          >
            {t("weekNext")}
            <ChevronLeft className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <LoadingState /> : null}
        {isError ? (
          <ErrorState
            title={tCommon("errorTitle")}
            onRetry={() => {
              void membersQuery.refetch();
              void attendanceQuery.refetch();
              void leaveQuery.refetch();
            }}
          />
        ) : null}
        {!isLoading && !isError && members.length === 0 ? (
          <EmptyState title={t("weekEmpty")} />
        ) : null}
        {!isLoading && !isError && members.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky start-0 z-10 min-w-40 bg-background">
                      {t("weekMember")}
                    </TableHead>
                    {days.map((day) => (
                      <TableHead
                        key={day}
                        className={cn(
                          "min-w-24 text-center",
                          day === today && "bg-primary/5",
                        )}
                      >
                        {formatDate(day, "ddd D")}
                      </TableHead>
                    ))}
                    <TableHead className="min-w-20 text-center">
                      {t("weekTotal")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    let weekTotal = 0;
                    return (
                      <TableRow key={member.id}>
                        <TableCell className="sticky start-0 z-10 bg-background">
                          <div className="flex items-center gap-2">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-medium text-primary">
                              {memberInitial(member.fullName)}
                            </span>
                            <span className="font-medium">
                              {member.fullName}
                            </span>
                          </div>
                        </TableCell>
                        {days.map((day) => {
                          const leave = (leaveByUser.get(member.id) ?? []).find(
                            (row) => overlapsDay(row, day),
                          );
                          const record = attendanceByUserDay.get(
                            `${member.id}:${day}`,
                          );
                          if (record?.totalHours != null) {
                            weekTotal += record.totalHours;
                          }

                          if (leave && !record) {
                            return (
                              <TableCell
                                key={day}
                                className={cn(
                                  "text-center",
                                  day === today && "bg-primary/5",
                                )}
                                title={leave.leaveType?.name ?? undefined}
                              >
                                <span className="inline-flex size-8 items-center justify-center rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300">
                                  <Plane className="size-3.5" />
                                </span>
                              </TableCell>
                            );
                          }

                          if (!record) {
                            return (
                              <TableCell
                                key={day}
                                className={cn(
                                  "text-center text-muted-foreground",
                                  day === today && "bg-primary/5",
                                )}
                              >
                                —
                              </TableCell>
                            );
                          }

                          const breakdown = summarizeAllocations(record);
                          return (
                            <TableCell
                              key={day}
                              className={cn(
                                "p-1 text-center",
                                day === today && "bg-primary/5",
                              )}
                            >
                              <button
                                type="button"
                                className="hover:bg-muted/60 w-full rounded-md px-1 py-1.5 transition-colors"
                                onClick={() => onOpenRecord(record)}
                              >
                                <div
                                  className={cn(
                                    "text-sm font-semibold tabular-nums",
                                    hoursTextClass(record.status),
                                  )}
                                >
                                  {record.totalHours ?? "—"}
                                </div>
                                {(breakdown.taskHours > 0 ||
                                  breakdown.generalHours > 0) && (
                                  <div className="mt-0.5 space-y-0.5 text-[0.65rem] leading-tight text-muted-foreground">
                                    {breakdown.taskHours > 0 ? (
                                      <div>
                                        {t("weekTaskHours", {
                                          hours: breakdown.taskHours,
                                        })}
                                      </div>
                                    ) : null}
                                    {breakdown.generalHours > 0 ? (
                                      <div>
                                        {t("weekGeneralHours", {
                                          hours: breakdown.generalHours,
                                        })}
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                                <span
                                  className={cn(
                                    "mx-auto mt-1 block size-1.5 rounded-full",
                                    statusDotClass(record.status),
                                  )}
                                  aria-hidden
                                />
                              </button>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center text-sm font-semibold tabular-nums">
                          {weekTotal > 0 ? weekTotal : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                {t("legendApproved")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500" />
                {t("legendPending")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-destructive" />
                {t("legendRejected")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Plane className="size-3 text-violet-600" />
                {t("legendLeave")}
              </span>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
