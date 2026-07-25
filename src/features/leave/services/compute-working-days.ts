import { LEAVE_TIMEZONE } from "@/features/leave/types/leave.types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse YYYY-MM-DD as a UTC noon date to avoid DST / timezone day shifts. */
export function parseCalendarDate(date: string): Date {
  if (!DATE_RE.test(date)) {
    throw new Error("INVALID_DATE");
  }
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function calendarYear(date: string): number {
  return Number(date.slice(0, 4));
}

export function assertSameCalendarYear(startDate: string, endDate: string): void {
  if (calendarYear(startDate) !== calendarYear(endDate)) {
    throw new Error("LEAVE_YEAR_MISMATCH");
  }
}

/**
 * Inclusive working days between start and end (YYYY-MM-DD).
 * Friday (5) and Saturday (6) are weekend in Asia/Riyadh org calendar.
 * Rejects cross-year ranges and invalid order.
 */
export function computeWorkingDays(startDate: string, endDate: string): number {
  assertSameCalendarYear(startDate, endDate);

  const start = parseCalendarDate(startDate);
  const end = parseCalendarDate(endDate);

  if (end.getTime() < start.getTime()) {
    throw new Error("INVALID_DATE_RANGE");
  }

  let count = 0;
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const day = cursor.getUTCDay(); // 0 Sun … 5 Fri 6 Sat
    if (day !== 5 && day !== 6) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (count === 0) {
    throw new Error("ZERO_WORKING_DAYS");
  }

  return count;
}

/** Remaining days available for new leave submissions. */
export function remainingForSubmit(
  allocatedDays: number,
  usedDays: number,
  pendingDays: number,
): number {
  return allocatedDays - usedDays - pendingDays;
}

/** Remaining days that can still be committed on approve (used only). */
export function remainingForApprove(
  allocatedDays: number,
  usedDays: number,
): number {
  return allocatedDays - usedDays;
}

export function calendarDateInOrgTimezone(
  instant: Date = new Date(),
  timeZone: string = LEAVE_TIMEZONE,
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
