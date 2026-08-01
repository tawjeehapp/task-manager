import {
  addCalendarDays,
  currentWeekBounds,
  isOrgWeekend,
} from "@/lib/org-calendar";

export type AttendanceActionRecord = {
  id: string;
  date: string;
  status: string;
  rejectionReason?: string | null;
};

export type AttendanceActions = {
  rejected: AttendanceActionRecord[];
  missingDates: string[];
};

/**
 * Working days from week start through `today` with no attendance row,
 * plus rejected records that still need the employee to correct/resubmit.
 */
export function deriveAttendanceActions(input: {
  today: string;
  weekAttendance: AttendanceActionRecord[];
}): AttendanceActions {
  const { today, weekAttendance } = input;
  const { start } = currentWeekBounds(today);

  const recordedDates = new Set(weekAttendance.map((row) => row.date));

  const missingDates: string[] = [];
  for (
    let date = start;
    date <= today;
    date = addCalendarDays(date, 1)
  ) {
    if (isOrgWeekend(date)) continue;
    if (recordedDates.has(date)) continue;
    missingDates.push(date);
  }

  const rejected = weekAttendance
    .filter((row) => row.status === "rejected")
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return { rejected, missingDates };
}
