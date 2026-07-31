"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import {
  AttendanceSubmitForm,
  workLogsToAllocations,
} from "@/features/attendance/components/attendance-submit-form";
import type { AttendanceRecord } from "@/features/attendance/types/attendance.types";
import type { WorkLog } from "@/features/work-logs/types/work-log.types";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AttendanceEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewerId: string;
  record: AttendanceRecord | null;
  onSuccess?: (record: AttendanceRecord) => void;
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

export function canEmployeeEditAttendance(
  record: Pick<AttendanceRecord, "status" | "uiState">,
): boolean {
  return record.status === "pending" || record.status === "rejected";
}

export function AttendanceEditDialog({
  open,
  onOpenChange,
  viewerId,
  record,
  onSuccess,
}: AttendanceEditDialogProps) {
  const t = useTranslations("attendance");
  const tCommon = useTranslations("common");

  const workLogsQuery = useQuery({
    queryKey: ["work-logs", "for-attendance", record?.date, viewerId],
    queryFn: async () => {
      if (!record) return [];
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
        userId: viewerId,
        dateFrom: record.date,
        dateTo: record.date,
        sortBy: "date",
        sortDir: "asc",
      });
      const response = await fetch(`/api/work-logs?${params}`);
      const data = await readApi<WorkLogListResult>(response);
      return data.items;
    },
    enabled: open && Boolean(record),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("editAttendanceTitle")}</DialogTitle>
        </DialogHeader>

        {!record ? null : workLogsQuery.isLoading ? (
          <LoadingState />
        ) : workLogsQuery.isError ? (
          <ErrorState
            title={tCommon("errorTitle")}
            description={(workLogsQuery.error as Error).message}
            onRetry={() => void workLogsQuery.refetch()}
          />
        ) : (
          <AttendanceSubmitForm
            key={`${record.id}-${workLogsQuery.dataUpdatedAt}`}
            viewerId={viewerId}
            defaultDate={record.date}
            editRecord={record}
            initialAllocations={workLogsToAllocations(workLogsQuery.data ?? [])}
            onSuccess={(updated) => {
              onOpenChange(false);
              onSuccess?.(updated);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
