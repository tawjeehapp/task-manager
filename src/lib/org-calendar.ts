import { calendarDateInOrgTimezone } from "@/features/attendance/services/compute-hours";
import { ATTENDANCE_TIMEZONE } from "@/features/attendance/types/attendance.types";

/** Add whole calendar days to a YYYY-MM-DD string (UTC date arithmetic). */
export function addCalendarDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Inclusive start/end of the calendar month containing `today` (YYYY-MM-DD). */
export function currentMonthBounds(today: string): {
  start: string;
  end: string;
  month: string;
} {
  const [y, m] = today.split("-");
  const start = `${y}-${m}-01`;
  const nextMonth =
    Number(m) === 12
      ? `${Number(y) + 1}-01-01`
      : `${y}-${String(Number(m) + 1).padStart(2, "0")}-01`;
  const end = addCalendarDays(nextMonth, -1);
  return { start, end, month: `${y}-${m}` };
}

export function todayInOrgTimezone(instant: Date = new Date()): string {
  return calendarDateInOrgTimezone(instant, ATTENDANCE_TIMEZONE);
}

/**
 * Inclusive Sunday–Saturday week containing `today` (YYYY-MM-DD).
 * Gulf work week often starts Sunday; Fri–Sat are weekend.
 */
export function currentWeekBounds(today: string): {
  start: string;
  end: string;
} {
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay(); // 0 Sun … 6 Sat
  const start = addCalendarDays(today, -day);
  const end = addCalendarDays(start, 6);
  return { start, end };
}

/** True when the UTC weekday of `dateIso` is Friday (5) or Saturday (6). */
export function isOrgWeekend(dateIso: string): boolean {
  const [y, m, d] = dateIso.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 5 || day === 6;
}
