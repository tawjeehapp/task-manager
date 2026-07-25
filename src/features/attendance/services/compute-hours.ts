import { ATTENDANCE_TIMEZONE } from "@/features/attendance/types/attendance.types";

/**
 * Total worked hours = (clock_out - clock_in) minus break, in hours.
 * Rounded to 2 decimal places. Throws if range is invalid.
 */
export function computeTotalHours(
  clockInIso: string,
  clockOutIso: string,
  breakMinutes: number,
): number {
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
    throw new Error("INVALID_BREAK_MINUTES");
  }

  const start = Date.parse(clockInIso);
  const end = Date.parse(clockOutIso);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error("INVALID_TIME");
  }

  if (end <= start) {
    throw new Error("INVALID_TIME_RANGE");
  }

  const rawMs = end - start - breakMinutes * 60_000;
  if (rawMs < 0) {
    throw new Error("BREAK_EXCEEDS_DURATION");
  }

  return Math.round((rawMs / 3_600_000) * 100) / 100;
}

/** Calendar date YYYY-MM-DD in the organization timezone. */
export function calendarDateInOrgTimezone(
  instant: Date = new Date(),
  timeZone: string = ATTENDANCE_TIMEZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("DATE_FORMAT_FAILED");
  }

  return `${year}-${month}-${day}`;
}
