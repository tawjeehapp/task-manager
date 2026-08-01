import {
  CAPACITY_LOAD_STATUSES,
  type TaskStatus,
} from "@/features/tasks/types/task.types";
import { addCalendarDays, isOrgWeekend } from "@/lib/org-calendar";

/** Working days in a full org week (Sun–Thu). */
export const ORG_WORKING_DAYS_PER_WEEK = 5;

export type LeaveDateRange = {
  startDate: string;
  endDate: string;
};

/**
 * Count org working days in [rangeStart, rangeEnd] covered by any leave range.
 * Weekends (Fri–Sat) are excluded.
 */
export function countApprovedLeaveDaysInRange(
  rangeStart: string,
  rangeEnd: string,
  leaves: LeaveDateRange[],
): number {
  if (leaves.length === 0 || rangeEnd < rangeStart) {
    return 0;
  }

  let count = 0;
  let cursor = rangeStart;
  while (cursor <= rangeEnd) {
    if (!isOrgWeekend(cursor)) {
      const onLeave = leaves.some(
        (leave) => leave.startDate <= cursor && leave.endDate >= cursor,
      );
      if (onLeave) {
        count += 1;
      }
    }
    cursor = addCalendarDays(cursor, 1);
  }
  return count;
}

export function computeAvailableHours(
  weeklyCapacityHours: number,
  leaveDaysInWeek: number,
): number {
  const leaveDays = Math.min(
    Math.max(0, leaveDaysInWeek),
    ORG_WORKING_DAYS_PER_WEEK,
  );
  const available =
    (weeklyCapacityHours * (ORG_WORKING_DAYS_PER_WEEK - leaveDays)) /
    ORG_WORKING_DAYS_PER_WEEK;
  return Math.round(available * 100) / 100;
}

export function computeCapacityPercent(
  loadHours: number,
  availableHours: number,
): number {
  if (availableHours > 0) {
    return Math.round((loadHours / availableHours) * 1000) / 10;
  }
  return loadHours > 0 ? 100 : 0;
}

export function isCapacityLoadStatus(status: string): boolean {
  return (CAPACITY_LOAD_STATUSES as readonly string[]).includes(status);
}

/** Pure capacity load from assigned task rows (todo + in_progress only). */
export function computeCapacityLoad(
  tasks: Array<{ status: TaskStatus | string; estimatedHours: number }>,
): { activeTaskCount: number; estimatedHours: number } {
  let activeTaskCount = 0;
  let estimatedHours = 0;

  for (const task of tasks) {
    if (!isCapacityLoadStatus(task.status)) {
      continue;
    }
    activeTaskCount += 1;
    estimatedHours += task.estimatedHours;
  }

  return {
    activeTaskCount,
    estimatedHours: Math.round(estimatedHours * 100) / 100,
  };
}

export function computeEmployeeCapacity(input: {
  userId: string;
  weeklyCapacityHours: number;
  leaveDaysInWeek: number;
  tasks: Array<{ status: TaskStatus | string; estimatedHours: number }>;
}): {
  userId: string;
  activeTaskCount: number;
  estimatedHours: number;
  weeklyCapacityHours: number;
  leaveDaysInWeek: number;
  availableHours: number;
  capacityPercent: number;
} {
  const load = computeCapacityLoad(input.tasks);
  const leaveDays = Math.min(
    Math.max(0, input.leaveDaysInWeek),
    ORG_WORKING_DAYS_PER_WEEK,
  );
  const availableHours = computeAvailableHours(
    input.weeklyCapacityHours,
    leaveDays,
  );
  return {
    userId: input.userId,
    activeTaskCount: load.activeTaskCount,
    estimatedHours: load.estimatedHours,
    weeklyCapacityHours: input.weeklyCapacityHours,
    leaveDaysInWeek: leaveDays,
    availableHours,
    capacityPercent: computeCapacityPercent(load.estimatedHours, availableHours),
  };
}
