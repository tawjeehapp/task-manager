import { addCalendarDays } from "@/lib/org-calendar";

export function resolveBarDates(input: {
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
}): { barStart: string; barEnd: string } {
  const createdDate = input.createdAt.slice(0, 10);
  const due = input.dueDate;
  const start = input.startDate;

  if (start && due) {
    return start <= due
      ? { barStart: start, barEnd: due }
      : { barStart: due, barEnd: start };
  }
  if (start && !due) {
    return { barStart: start, barEnd: start };
  }
  if (!start && due) {
    return { barStart: addCalendarDays(due, -1), barEnd: due };
  }
  return { barStart: createdDate, barEnd: createdDate };
}

export function isTaskOverdue(input: {
  dueDate: string | null;
  status: string;
  today: string;
}): boolean {
  if (!input.dueDate || input.status === "completed") {
    return false;
  }
  return input.dueDate < input.today;
}
