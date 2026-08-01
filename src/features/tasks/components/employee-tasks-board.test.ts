import { describe, expect, it } from "vitest";

import {
  filterEmployeeBoardTasks,
  formatCardDate,
  formatTaskDateRange,
  isDueTodayTask,
  isLateTask,
} from "@/features/tasks/components/employee-tasks-board";
import type { Task } from "@/features/tasks/types/task.types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    projectId: "p1",
    project: {
      id: "p1",
      name: "Website",
      departmentId: "d1",
    },
    title: "Design homepage",
    description: null,
    status: "todo",
    priority: "medium",
    assignedTo: "u1",
    assignee: null,
    createdBy: "u2",
    createdByUser: null,
    startDate: null,
    dueDate: "2026-07-20",
    estimatedHours: null,
    progressPercentage: 0,
    completedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("isLateTask", () => {
  it("marks incomplete past-due tasks as late", () => {
    expect(isLateTask(makeTask(), "2026-07-26")).toBe(true);
    expect(
      isLateTask(makeTask({ status: "completed" }), "2026-07-26"),
    ).toBe(false);
    expect(
      isLateTask(makeTask({ dueDate: "2026-07-26" }), "2026-07-26"),
    ).toBe(false);
  });
});

describe("isDueTodayTask", () => {
  it("marks incomplete tasks due today", () => {
    expect(
      isDueTodayTask(makeTask({ dueDate: "2026-07-26" }), "2026-07-26"),
    ).toBe(true);
    expect(isDueTodayTask(makeTask(), "2026-07-26")).toBe(false);
    expect(
      isDueTodayTask(
        makeTask({ dueDate: "2026-07-26", status: "completed" }),
        "2026-07-26",
      ),
    ).toBe(false);
  });
});

describe("formatTaskDateRange", () => {
  it("returns due date only", () => {
    expect(
      formatTaskDateRange(
        makeTask({ startDate: "2026-07-20", dueDate: "2026-07-26" }),
      ),
    ).toBe(formatCardDate("2026-07-26"));
    expect(
      formatTaskDateRange(makeTask({ startDate: "2026-07-20", dueDate: null })),
    ).toBeNull();
    expect(
      formatTaskDateRange(makeTask({ startDate: null, dueDate: null })),
    ).toBeNull();
  });
});

describe("filterEmployeeBoardTasks", () => {
  const tasks = [
    makeTask({ id: "1", title: "Alpha", status: "todo", priority: "high" }),
    makeTask({
      id: "2",
      title: "Beta",
      status: "in_progress",
      priority: "low",
      dueDate: "2026-07-30",
    }),
    makeTask({
      id: "3",
      title: "Gamma design",
      status: "blocked",
      priority: "medium",
      dueDate: "2026-07-10",
    }),
  ];

  it("filters by search, status, priority, and late only", () => {
    expect(
      filterEmployeeBoardTasks(tasks, {
        search: "design",
        status: "",
        priority: "",
        lateOnly: false,
        today: "2026-07-26",
      }).map((t) => t.id),
    ).toEqual(["3"]);

    expect(
      filterEmployeeBoardTasks(tasks, {
        search: "alpha",
        status: "",
        priority: "",
        lateOnly: false,
        today: "2026-07-26",
      }).map((t) => t.id),
    ).toEqual(["1"]);

    expect(
      filterEmployeeBoardTasks(tasks, {
        search: "",
        status: "in_progress",
        priority: "",
        lateOnly: false,
        today: "2026-07-26",
      }).map((t) => t.id),
    ).toEqual(["2"]);

    expect(
      filterEmployeeBoardTasks(tasks, {
        search: "",
        status: "",
        priority: "high",
        lateOnly: false,
        today: "2026-07-26",
      }).map((t) => t.id),
    ).toEqual(["1"]);

    expect(
      filterEmployeeBoardTasks(tasks, {
        search: "",
        status: "",
        priority: "",
        lateOnly: true,
        today: "2026-07-26",
      }).map((t) => t.id),
    ).toEqual(["1", "3"]);
  });
});
