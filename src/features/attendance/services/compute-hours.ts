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

/** Extract HH:mm wall time in the organization timezone from an ISO instant. */
export function orgLocalTimeOfDay(
  iso: string,
  timeZone: string = ATTENDANCE_TIMEZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));

  let hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;
  if (!hour || !minute) {
    throw new Error("TIME_FORMAT_FAILED");
  }
  if (hour === "24") hour = "00";
  return `${hour}:${minute}`;
}

/**
 * Build timestamptz ISO for an org-local wall time on a YYYY-MM-DD date.
 * Asia/Riyadh is UTC+3 year-round (no DST).
 */
export function orgLocalDateTimeIso(
  date: string,
  timeOfDay: string,
): string {
  const [hoursRaw, minutesRaw, secondsRaw] = timeOfDay.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const seconds = secondsRaw !== undefined ? Number(secondsRaw) : 0;

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    throw new Error("INVALID_TIME");
  }

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${date}T${hh}:${mm}:${ss}.000+03:00`;
}
