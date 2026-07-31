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
