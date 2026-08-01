"use client";

import { useTranslations } from "next-intl";

import {
  timeRangeLabel,
} from "@/features/attendance/components/attendance-display-utils";
import type { AttendanceRecord } from "@/features/attendance/types/attendance.types";
import { formatDate } from "@/lib/dates";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AttendanceReviewDialogProps = {
  record: AttendanceRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isApproving?: boolean;
};

export function AttendanceReviewDialog({
  record,
  open,
  onOpenChange,
  onApprove,
  onReject,
  isApproving = false,
}: AttendanceReviewDialogProps) {
  const t = useTranslations("attendance");

  const allocations = record?.allocations ?? [];
  const snapshot = record?.eligibleTasksSnapshot ?? [];
  const generalHours = allocations
    .filter((row) => row.kind === "general")
    .reduce((sum, row) => sum + row.hours, 0);
  const showEligibleWarning = generalHours > 0 && snapshot.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[min(90vh,40rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("reviewTitle")}</DialogTitle>
        </DialogHeader>

        {record ? (
          <div className="space-y-4">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t("employee")}</dt>
                <dd className="font-medium">
                  {record.user?.fullName ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("date")}</dt>
                <dd className="font-medium">{formatDate(record.date)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("clockInOutColumn")}</dt>
                <dd className="font-medium">
                  {timeRangeLabel(record.clockIn, record.clockOut)}
                </dd>
              </div>
              {record.breakMinutes > 0 ? (
                <div>
                  <dt className="text-muted-foreground">{t("breakLabel")}</dt>
                  <dd className="text-muted-foreground">
                    {t("breakMinutesValue", { minutes: record.breakMinutes })}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">{t("netHoursColumn")}</dt>
                <dd className="font-medium">
                  {record.totalHours != null
                    ? t("hoursValue", { hours: record.totalHours })
                    : "—"}
                </dd>
              </div>
            </dl>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">{t("reviewAllocations")}</h3>
              {allocations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("reviewAllocationsEmpty")}
                </p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {allocations.map((row, index) => (
                    <li
                      key={`${row.kind}-${row.taskId ?? "general"}-${index}`}
                      className="rounded-md border border-border px-3 py-2"
                    >
                      {row.kind === "task" ? (
                        <div className="flex items-start justify-between gap-2">
                          <span>{row.title}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {t("hoursValue", { hours: row.hours })}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <span>{t("entryTypeGeneral")}</span>
                            <span className="shrink-0 text-muted-foreground">
                              {t("hoursValue", { hours: row.hours })}
                            </span>
                          </div>
                          {row.reason ? (
                            <p className="text-muted-foreground">{row.reason}</p>
                          ) : null}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">
                {t("reviewEligibleTasks")}
              </h3>
              {showEligibleWarning ? (
                <Alert>
                  <AlertDescription>
                    {t("reviewEligibleWarning")}
                  </AlertDescription>
                </Alert>
              ) : null}
              {snapshot.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("reviewEligibleEmpty")}
                </p>
              ) : (
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {snapshot.map((task) => (
                    <li key={task.id}>{task.title}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("reviewClose")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!record}
            onClick={() => {
              if (!record) return;
              onReject(record.id);
            }}
          >
            {t("reject")}
          </Button>
          <Button
            type="button"
            disabled={!record || isApproving}
            onClick={() => {
              if (!record) return;
              onApprove(record.id);
            }}
          >
            {t("approve")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
