import { describe, expect, it } from "vitest";

import { countEmployeeTaskMetrics } from "@/features/dashboard/lib/actionable-tasks";

describe("countEmployeeTaskMetrics", () => {
  const today = "2026-07-31";

  it("counts root tasks and subtasks together", () => {
    const result = countEmployeeTaskMetrics(
      [
        { status: "in_progress", due_date: "2026-08-07" },
        { status: "completed", due_date: "2026-07-30" },
        { status: "in_progress", due_date: today },
        { status: "todo", due_date: "2026-07-20" },
      ],
      today,
    );

    expect(result).toEqual({
      todo: 1,
      inProgress: 2,
      blocked: 0,
      completed: 1,
      overdue: 1,
      dueToday: 1,
    });
  });

  it("normalizes timestamp due dates for today/overdue", () => {
    const result = countEmployeeTaskMetrics(
      [
        { status: "todo", due_date: `${today}T00:00:00.000Z` },
        { status: "todo", due_date: "2026-07-29T12:00:00.000Z" },
      ],
      today,
    );

    expect(result.dueToday).toBe(1);
    expect(result.overdue).toBe(1);
  });
});
