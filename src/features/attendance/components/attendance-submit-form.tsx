"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import type { AttendanceRecord } from "@/features/attendance/types/attendance.types";
import {
  buildAllocationsFromForm,
  initialTaskRowsFromAllocations,
  type BuiltAllocation,
} from "@/features/attendance/lib/build-allocations-from-form";
import {
  computeTotalHours,
  orgLocalDateTimeIso,
  orgLocalTimeOfDay,
} from "@/features/attendance/services/compute-hours";
import { Time24Input } from "@/features/attendance/components/time-24-input";
import type { WorkLog } from "@/features/work-logs/types/work-log.types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TaskOption = {
  id: string;
  title: string;
};

type TaskRow = {
  key: string;
  taskId: string;
  hours: string;
};

export type AttendanceFormAllocation =
  | {
      type: "task";
      taskId: string;
      hours: number;
      title?: string;
    }
  | {
      type: "general";
      reason: string;
      hours: number;
    };

type AttendanceSubmitFormProps = {
  viewerId: string;
  defaultDate: string;
  /** When set, form edits an existing pending/rejected record. */
  editRecord?: AttendanceRecord | null;
  initialAllocations?: AttendanceFormAllocation[];
  onSuccess?: (record: AttendanceRecord) => void;
  submitLabel?: string;
  /**
   * When true, the work date is fixed to `defaultDate` and the date field is hidden
   * (e.g. dashboard “today” form). Other days are submitted from actions or /attendance.
   */
  lockDate?: boolean;
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

function newRowKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyRow(): TaskRow {
  return {
    key: newRowKey(),
    taskId: "",
    hours: "",
  };
}

function safeNetHours(
  date: string,
  clockIn: string,
  clockOut: string,
  breakMinutes: number,
): number | null {
  if (!date || !clockIn || !clockOut) return null;
  try {
    return computeTotalHours(
      orgLocalDateTimeIso(date, clockIn),
      orgLocalDateTimeIso(date, clockOut),
      breakMinutes,
    );
  } catch {
    return null;
  }
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

export function AttendanceSubmitForm({
  viewerId,
  defaultDate,
  editRecord = null,
  initialAllocations,
  onSuccess,
  submitLabel,
  lockDate = false,
}: AttendanceSubmitFormProps) {
  const t = useTranslations("attendance");
  const queryClient = useQueryClient();
  const isEdit = Boolean(editRecord);
  const dateLocked = lockDate || isEdit;

  const seeded = useMemo(
    () => initialTaskRowsFromAllocations(initialAllocations),
    [initialAllocations],
  );

  const [date, setDate] = useState(editRecord?.date ?? defaultDate);
  const [clockIn, setClockIn] = useState(
    editRecord ? orgLocalTimeOfDay(editRecord.clockIn) : "08:00",
  );
  const [clockOut, setClockOut] = useState(
    editRecord?.clockOut
      ? orgLocalTimeOfDay(editRecord.clockOut)
      : "16:00",
  );
  const [breakMinutes, setBreakMinutes] = useState(
    String(editRecord?.breakMinutes ?? 30),
  );
  const [rows, setRows] = useState<TaskRow[]>(() =>
    seeded.rows.map((row) => ({
      key: newRowKey(),
      taskId: row.taskId,
      hours: row.hours,
    })),
  );
  const [remainderReason, setRemainderReason] = useState(
    seeded.remainderReason,
  );
  const [formError, setFormError] = useState<string | null>(null);

  const tasksQuery = useQuery({
    queryKey: ["attendance", "eligible-tasks", viewerId],
    queryFn: async () => {
      const response = await fetch("/api/attendance/eligible-tasks");
      const data = await readApi<{ items: TaskOption[] }>(response);
      return data.items;
    },
  });

  const breakValue = Number(breakMinutes) || 0;
  const netHours = useMemo(
    () => safeNetHours(date, clockIn, clockOut, breakValue),
    [date, clockIn, clockOut, breakValue],
  );

  const taskHours = useMemo(() => {
    const sum = rows.reduce((acc, row) => {
      const n = Number(row.hours);
      return acc + (Number.isFinite(n) && n > 0 && row.taskId ? n : 0);
    }, 0);
    return roundHours(sum);
  }, [rows]);

  const remainingHours =
    netHours == null ? null : roundHours(netHours - taskHours);

  const saveMutation = useMutation({
    mutationFn: async (allocations: BuiltAllocation[]) => {
      const body = {
        clockIn,
        clockOut,
        breakMinutes: breakValue,
        allocations,
      };

      const response = isEdit
        ? await fetch(`/api/attendance/${editRecord!.id}/resubmit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/attendance/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, date }),
          });

      return readApi<AttendanceRecord>(response);
    },
    onSuccess: async (record) => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["work-logs"] });
      onSuccess?.(record);
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function updateRow(key: string, patch: Partial<TaskRow>) {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function removeRow(key: string) {
    setRows((prev) => {
      const next = prev.filter((row) => row.key !== key);
      return next.length > 0 ? next : [emptyRow()];
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (netHours == null) {
      setFormError(t("invalidTimeRange"));
      return;
    }

    const result = buildAllocationsFromForm({
      taskRows: rows.map((row) => ({
        taskId: row.taskId,
        hours: row.hours,
      })),
      netHours,
      remainderReason,
    });

    if (!result.ok) {
      if (result.code === "over_allocated") {
        setFormError(t("allocationExceedsNet"));
      } else if (result.code === "reason_required") {
        setFormError(t("remainderReasonRequired"));
      } else if (result.code === "incomplete_task_row") {
        setFormError(t("allocationIncomplete"));
      } else if (result.code === "duplicate_task") {
        setFormError(t("allocationDuplicate"));
      } else {
        setFormError(t("allocationRequired"));
      }
      return;
    }

    saveMutation.mutate(result.allocations);
  }

  const assignedTasks = tasksQuery.data ?? [];
  const selectedIds = new Set(
    rows.filter((r) => r.taskId).map((r) => r.taskId),
  );
  // Keep currently allocated tasks visible even if no longer assigned
  const selectOptions = useMemo(() => {
    const byId = new Map(assignedTasks.map((task) => [task.id, task]));
    for (const row of initialAllocations ?? []) {
      if (row.type === "task" && !byId.has(row.taskId)) {
        byId.set(row.taskId, {
          id: row.taskId,
          title: row.title ?? row.taskId,
        });
      }
    }
    return Array.from(byId.values());
  }, [assignedTasks, initialAllocations]);

  const showRemainder = remainingHours != null && remainingHours > 0;
  const overAllocated = remainingHours != null && remainingHours < 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {dateLocked ? null : (
          <div className="space-y-1.5">
            <Label htmlFor="attendance-date">{t("dayLabel")}</Label>
            <Input
              id="attendance-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="attendance-break">{t("breakMinutesLabeled")}</Label>
          <Input
            id="attendance-break"
            type="number"
            min={0}
            step={1}
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="attendance-clock-in">{t("entryTime")}</Label>
          <Time24Input
            id="attendance-clock-in"
            value={clockIn}
            onChange={setClockIn}
            required
            aria-label={t("entryTime")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="attendance-clock-out">{t("exitTime")}</Label>
          <Time24Input
            id="attendance-clock-out"
            value={clockOut}
            onChange={setClockOut}
            required
            aria-label={t("exitTime")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>{t("taskAllocations")}</Label>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="size-4" />
            {t("addTaskRow")}
          </Button>
        </div>

        {tasksQuery.isLoading ? (
          <p className="text-muted-foreground text-sm">{t("loadingTasks")}</p>
        ) : null}
        {!tasksQuery.isLoading && selectOptions.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noAssignedTasks")}</p>
        ) : null}

        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid gap-2 sm:grid-cols-[1fr_5.5rem_auto]"
            >
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={row.taskId}
                onChange={(e) =>
                  updateRow(row.key, { taskId: e.target.value })
                }
                aria-label={t("selectTask")}
                disabled={selectOptions.length === 0}
              >
                <option value="">{t("selectTask")}</option>
                {selectOptions.map((task) => (
                  <option
                    key={task.id}
                    value={task.id}
                    disabled={
                      selectedIds.has(task.id) && task.id !== row.taskId
                    }
                  >
                    {task.title}
                  </option>
                ))}
              </select>

              <Input
                type="number"
                min={0}
                step={0.25}
                placeholder={t("hours")}
                value={row.hours}
                onChange={(e) =>
                  updateRow(row.key, { hours: e.target.value })
                }
                aria-label={t("hours")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(row.key)}
                aria-label={t("removeTimeRow")}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {showRemainder ? (
        <div className="space-y-2 rounded-md border border-border bg-muted/40 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{t("remainderLabel")}</span>
            <span className="tabular-nums">
              {t("hoursValue", { hours: remainingHours })}
            </span>
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="attendance-remainder-reason"
              className="text-xs text-muted-foreground"
            >
              {t("remainderReason")}
            </Label>
            <Input
              id="attendance-remainder-reason"
              value={remainderReason}
              onChange={(e) => setRemainderReason(e.target.value)}
              placeholder={t("remainderReasonPlaceholder")}
              aria-label={t("remainderReason")}
              className="h-8 text-sm"
            />
          </div>
        </div>
      ) : null}

      {overAllocated ? (
        <Alert variant="destructive">
          <AlertDescription>{t("allocationExceedsNet")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 px-4 py-4 text-emerald-950">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-base font-semibold">{t("netCalculated")}</span>
          <span className="text-xl font-bold tabular-nums tracking-tight">
            {netHours != null
              ? t("hoursValue", { hours: netHours })
              : "—"}
          </span>
        </div>
        {netHours != null ? (
          <p className="mt-1.5 text-sm text-emerald-900/70">
            {t("allocationSummary", {
              allocated: taskHours,
              remaining: remainingHours ?? 0,
            })}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={saveMutation.isPending || overAllocated}
        className="w-full sm:w-auto"
      >
        {saveMutation.isPending
          ? t("saving")
          : (submitLabel ?? (isEdit ? t("saveEdits") : t("saveAttendance")))}
      </Button>
    </form>
  );
}

export function workLogsToAllocations(
  logs: WorkLog[],
): AttendanceFormAllocation[] {
  return logs.map((log) => {
    if (!log.taskId) {
      return {
        type: "general" as const,
        reason: log.description ?? "",
        hours: log.hours,
      };
    }
    return {
      type: "task" as const,
      taskId: log.taskId,
      hours: log.hours,
      title: log.task?.title,
    };
  });
}
