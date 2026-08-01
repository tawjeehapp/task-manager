import { isOverdueTask } from "@/features/dashboard/services/leadership-aggregates";

/** Normalize API/DB dates to YYYY-MM-DD for calendar comparisons. */
export function calendarDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

export function isIncludedInTodayList(
  task: { status: string; dueDate: string | null },
  today: string,
): boolean {
  const dueDate = calendarDateOnly(task.dueDate);
  if (!dueDate) return false;
  if (dueDate > today) return false;
  if (task.status === "completed" && dueDate < today) return false;
  return true;
}

export function sortTodayListTasks<T extends { dueDate: string | null; status: string }>(
  tasks: T[],
  today: string,
): T[] {
  return [...tasks].sort((a, b) => {
    const aOverdue = isOverdueTask(a, today);
    const bOverdue = isOverdueTask(b, today);
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    if (a.dueDate !== b.dueDate) {
      return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
    }
    return 0;
  });
}

export type EmployeeTaskMetricCounts = {
  todo: number;
  inProgress: number;
  blocked: number;
  completed: number;
  overdue: number;
  dueToday: number;
};

/** Counts assigned tasks for employee dashboard metrics. */
export function countEmployeeTaskMetrics(
  rows: Array<{ status: string; due_date: string | null }>,
  today: string,
): EmployeeTaskMetricCounts {
  let todo = 0;
  let inProgress = 0;
  let blocked = 0;
  let completed = 0;
  let overdue = 0;
  let dueToday = 0;

  for (const row of rows) {
    const status = row.status;
    const dueDate = calendarDateOnly(row.due_date);
    if (status === "todo") todo += 1;
    if (status === "in_progress") inProgress += 1;
    if (status === "blocked") blocked += 1;
    if (status === "completed") completed += 1;
    if (status !== "completed" && dueDate && dueDate < today) overdue += 1;
    if (status !== "completed" && dueDate === today) dueToday += 1;
  }

  return { todo, inProgress, blocked, completed, overdue, dueToday };
}
