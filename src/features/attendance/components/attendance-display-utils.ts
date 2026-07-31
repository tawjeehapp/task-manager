import type { AttendanceRecord } from "@/features/attendance/types/attendance.types";
import { orgLocalTimeOfDay } from "@/features/attendance/services/compute-hours";

export type AttendanceAllocationDisplay = {
  kind: "task" | "general";
  taskId: string | null;
  title: string;
  hours: number;
  reason: string | null;
};

export function uiStateBadgeVariant(
  uiState: AttendanceRecord["uiState"],
): "default" | "secondary" | "destructive" | "outline" {
  if (uiState === "approved") return "default";
  if (uiState === "rejected") return "destructive";
  if (uiState === "currently_working") return "secondary";
  return "outline";
}

export function timeRangeLabel(
  clockIn: string,
  clockOut: string | null,
  breakMinutes?: number,
): string {
  try {
    const start = orgLocalTimeOfDay(clockIn);
    if (!clockOut) return start;
    const range = `${start} - ${orgLocalTimeOfDay(clockOut)}`;
    if (breakMinutes && breakMinutes > 0) {
      return `${range} (${breakMinutes}m)`;
    }
    return range;
  } catch {
    return "—";
  }
}

export function groupAllocationsByDate(
  logs: {
    date: string;
    taskId: string | null;
    title: string;
    hours: number;
    reason?: string | null;
  }[],
): Map<string, AttendanceAllocationDisplay[]> {
  const map = new Map<string, AttendanceAllocationDisplay[]>();
  for (const log of logs) {
    const list = map.get(log.date) ?? [];
    const kind = log.taskId ? "task" : "general";
    list.push({
      kind,
      taskId: log.taskId,
      title: log.title,
      hours: log.hours,
      reason: kind === "general" ? (log.reason ?? null) : null,
    });
    map.set(log.date, list);
  }
  return map;
}
