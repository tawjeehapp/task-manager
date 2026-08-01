"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import type { AttendanceRecord } from "@/features/attendance/types/attendance.types";
import {
  computeTotalHours,
  orgLocalDateTimeIso,
  orgLocalTimeOfDay,
} from "@/features/attendance/services/compute-hours";
import type { WorkLog } from "@/features/work-logs/types/work-log.types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TaskOption = {
  id: string;
  title: string;
};

type AllocationRowType = "task" | "general";

type AllocationRow = {
  key: string;
  type: AllocationRowType;
  taskId: string;
  reason: string;
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

function emptyRow(type: AllocationRowType = "task"): AllocationRow {
  return {
    key: newRowKey(),
    type,
    taskId: "",
    reason: "",
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

function initialRowsFromAllocations(
  allocations: AttendanceFormAllocation[] | undefined,
): AllocationRow[] {
  if (!allocations?.length) return [emptyRow()];
  return allocations.map((row) => {
    if (row.type === "general") {
      return {
        key: newRowKey(),
        type: "general" as const,
        taskId: "",
        reason: row.reason,
        hours: String(row.hours),
      };
    }
    return {
      key: newRowKey(),
      type: "task" as const,
      taskId: row.taskId,
      reason: "",
      hours: String(row.hours),
    };
  });
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
}: AttendanceSubmitFormProps) {
  const t = useTranslations("attendance");
  const queryClient = useQueryClient();
  const isEdit = Boolean(editRecord);

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
  const [rows, setRows] = useState<AllocationRow[]>(() =>
    initialRowsFromAllocations(initialAllocations),
  );
  const [formError, setFormError] = useState<string | null>(null);

  const tasksQuery = useQuery({
    queryKey: ["tasks", "assigned-tasks", viewerId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
        assignee: viewerId,
        sortBy: "title",
        sortDir: "asc",
      });
      const response = await fetch(`/api/tasks?${params}`);
      const data = await readApi<{ items: TaskOption[] }>(response);
      return data.items;
    },
  });

  const breakValue = Number(breakMinutes) || 0;
  const netHours = useMemo(
    () => safeNetHours(date, clockIn, clockOut, breakValue),
    [date, clockIn, clockOut, breakValue],
  );

  const allocatedHours = useMemo(() => {
    const sum = rows.reduce((acc, row) => {
      const n = Number(row.hours);
      return acc + (Number.isFinite(n) && n > 0 ? n : 0);
    }, 0);
    return roundHours(sum);
  }, [rows]);

  const remainingHours =
    netHours == null ? null : roundHours(netHours - allocatedHours);

  const taskHours = useMemo(() => {
    const sum = rows.reduce((acc, row) => {
      if (row.type !== "task") return acc;
      const n = Number(row.hours);
      return acc + (Number.isFinite(n) && n > 0 ? n : 0);
    }, 0);
    return roundHours(sum);
  }, [rows]);

  const generalHours = useMemo(() => {
    const sum = rows.reduce((acc, row) => {
      if (row.type !== "general") return acc;
      const n = Number(row.hours);
      return acc + (Number.isFinite(n) && n > 0 ? n : 0);
    }, 0);
    return roundHours(sum);
  }, [rows]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const allocations = rows.map((row) => {
        if (row.type === "general") {
          return {
            type: "general" as const,
            reason: row.reason.trim(),
            hours: Number(row.hours),
          };
        }
        return {
          type: "task" as const,
          taskId: row.taskId,
          hours: Number(row.hours),
        };
      });

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

  function updateRow(key: string, patch: Partial<AllocationRow>) {
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

    if (rows.length === 0) {
      setFormError(t("allocationRequired"));
      return;
    }

    const incomplete = rows.some((row) => {
      const hoursOk = Number(row.hours) > 0;
      if (!hoursOk) return true;
      if (row.type === "task") return !row.taskId;
      return row.reason.trim().length < 2;
    });
    if (incomplete) {
      setFormError(t("allocationIncomplete"));
      return;
    }

    const taskIds = rows
      .filter((r) => r.type === "task" && r.taskId)
      .map((r) => r.taskId);
    if (new Set(taskIds).size !== taskIds.length) {
      setFormError(t("allocationDuplicate"));
      return;
    }

    if (remainingHours !== 0) {
      setFormError(t("allocationMustEqualNet"));
      return;
    }

    saveMutation.mutate();
  }

  const assignedTasks = tasksQuery.data ?? [];
  const selectedIds = new Set(
    rows.filter((r) => r.type === "task" && r.taskId).map((r) => r.taskId),
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="attendance-date">{t("dayLabel")}</Label>
          <Input
            id="attendance-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            disabled={isEdit}
          />
        </div>
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
          <Input
            id="attendance-clock-in"
            type="time"
            value={clockIn}
            onChange={(e) => setClockIn(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="attendance-clock-out">{t("exitTime")}</Label>
          <Input
            id="attendance-clock-out"
            type="time"
            value={clockOut}
            onChange={(e) => setClockOut(e.target.value)}
            required
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
            <div key={row.key} className="space-y-2 rounded-md border p-3">
              <div
                className={
                  row.type === "general"
                    ? "grid gap-2 sm:grid-cols-[7.5rem_5.5rem_auto]"
                    : "grid gap-2 sm:grid-cols-[7.5rem_1fr_5.5rem_auto]"
                }
              >
                <select
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                  value={row.type}
                  onChange={(e) =>
                    updateRow(row.key, {
                      type: e.target.value as AllocationRowType,
                      taskId: "",
                      reason: "",
                    })
                  }
                  aria-label={t("entryType")}
                >
                  <option value="task">{t("entryTypeTask")}</option>
                  <option value="general">{t("entryTypeGeneral")}</option>
                </select>

                {row.type === "task" ? (
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
                ) : null}

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

              {row.type === "general" ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`general-reason-${row.key}`}>
                    {t("generalReason")}
                  </Label>
                  <Input
                    id={`general-reason-${row.key}`}
                    value={row.reason}
                    onChange={(e) =>
                      updateRow(row.key, { reason: e.target.value })
                    }
                    placeholder={t("generalReasonPlaceholder")}
                    aria-label={t("generalReason")}
                    className="w-full"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{t("netCalculated")}</span>
          <span className="font-medium tabular-nums">
            {netHours != null
              ? t("hoursValue", { hours: netHours })
              : "—"}
          </span>
        </div>
        {netHours != null ? (
          <p className="text-muted-foreground mt-1 text-xs">
            {t("allocationSummary", {
              allocated: taskHours,
              general: generalHours,
              remaining: remainingHours ?? 0,
            })}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={saveMutation.isPending}
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
