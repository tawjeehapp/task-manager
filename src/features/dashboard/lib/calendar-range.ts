import {
  addCalendarDays,
  currentMonthBounds,
  currentWeekBounds,
} from "@/lib/org-calendar";

export type CalendarViewMode = "day" | "week" | "month";

export function calendarRangeFor(
  mode: CalendarViewMode,
  focusDate: string,
): { dueFrom: string; dueTo: string } {
  if (mode === "day") {
    return { dueFrom: focusDate, dueTo: focusDate };
  }
  if (mode === "week") {
    const { start, end } = currentWeekBounds(focusDate);
    return { dueFrom: start, dueTo: end };
  }
  const { start, end } = currentMonthBounds(focusDate);
  return { dueFrom: start, dueTo: end };
}

/** Days in the week containing focusDate (Sun–Sat). */
export function weekDays(focusDate: string): string[] {
  const { start } = currentWeekBounds(focusDate);
  return Array.from({ length: 7 }, (_, i) => addCalendarDays(start, i));
}

/** Full month grid cells (leading/trailing days from adjacent months). Sunday-first. */
export function monthGridDays(focusDate: string): string[] {
  const { start, end } = currentMonthBounds(focusDate);
  const [y, m, d] = start.split("-").map(Number);
  const startDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const gridStart = addCalendarDays(start, -startDay);
  const [ey, em, ed] = end.split("-").map(Number);
  const endDay = new Date(Date.UTC(ey, em - 1, ed)).getUTCDay();
  const trailing = 6 - endDay;
  const gridEnd = addCalendarDays(end, trailing);
  const days: string[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return days;
}

export function shiftFocusDate(
  mode: CalendarViewMode,
  focusDate: string,
  direction: -1 | 1,
): string {
  if (mode === "day") {
    return addCalendarDays(focusDate, direction);
  }
  if (mode === "week") {
    return addCalendarDays(focusDate, direction * 7);
  }
  const [y, m] = focusDate.split("-").map(Number);
  const nextMonth = m + direction;
  const year = nextMonth < 1 ? y - 1 : nextMonth > 12 ? y + 1 : y;
  const month =
    nextMonth < 1 ? 12 : nextMonth > 12 ? 1 : nextMonth;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
