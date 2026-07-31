import { describe, expect, it } from "vitest";

import {
  isIncludedInTodayList,
  sortTodayListTasks,
} from "@/features/dashboard/lib/actionable-tasks";

function task(overrides: {
  status?: string;
  dueDate?: string | null;
} = {}) {
  return {
    status: "todo",
    dueDate: "2026-07-31",
    ...overrides,
  };
}

describe("actionable-tasks", () => {
  const today = "2026-07-31";

  describe("isIncludedInTodayList", () => {
    it("includes incomplete overdue tasks", () => {
      expect(isIncludedInTodayList(task({ dueDate: "2026-07-29" }), today)).toBe(
        true,
      );
    });

    it("includes incomplete tasks due today", () => {
      expect(isIncludedInTodayList(task(), today)).toBe(true);
    });

    it("includes completed tasks due today", () => {
      expect(
        isIncludedInTodayList(
          task({ status: "completed", dueDate: today }),
          today,
        ),
      ).toBe(true);
    });

    it("excludes completed overdue tasks", () => {
      expect(
        isIncludedInTodayList(
          task({ status: "completed", dueDate: "2026-07-29" }),
          today,
        ),
      ).toBe(false);
    });

    it("excludes future tasks and tasks without due date", () => {
      expect(isIncludedInTodayList(task({ dueDate: "2026-08-01" }), today)).toBe(
        false,
      );
      expect(isIncludedInTodayList(task({ dueDate: null }), today)).toBe(false);
    });

    it("normalizes timestamp due dates for comparison", () => {
      expect(
        isIncludedInTodayList(
          task({ dueDate: "2026-07-31T00:00:00.000Z" }),
          today,
        ),
      ).toBe(true);
    });
  });

  describe("sortTodayListTasks", () => {
    it("sorts overdue before due today, oldest overdue first", () => {
      const sorted = sortTodayListTasks(
        [
          { id: "a", ...task({ dueDate: today }) },
          { id: "b", ...task({ dueDate: "2026-07-25" }) },
          { id: "c", ...task({ dueDate: "2026-07-28" }) },
          { id: "d", ...task({ dueDate: today, status: "in_progress" }) },
        ],
        today,
      );
      expect(sorted.map((t) => t.id)).toEqual(["b", "c", "a", "d"]);
    });
  });
});
