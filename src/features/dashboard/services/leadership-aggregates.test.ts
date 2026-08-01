import { describe, expect, it } from "vitest";

import {
  aggregateLeadershipFromRows,
  computeProjectHealth,
  computeProjectProgress,
  deriveTodayStatus,
  isOverdueTask,
  type AggregateTaskRow,
} from "@/features/dashboard/services/leadership-aggregates";

function task(overrides: Partial<AggregateTaskRow> = {}): AggregateTaskRow {
  return {
    id: "t1",
    projectId: "p1",
    assignedTo: "u1",
    status: "todo",
    dueDate: "2026-07-20",
    estimatedHours: 4,
    progressPercentage: 25,
    ...overrides,
  };
}

describe("leadership aggregates", () => {
  it("detects overdue incomplete tasks", () => {
    expect(isOverdueTask(task(), "2026-07-26")).toBe(true);
    expect(
      isOverdueTask(task({ status: "completed" }), "2026-07-26"),
    ).toBe(false);
    expect(
      isOverdueTask(task({ dueDate: "2026-07-26" }), "2026-07-26"),
    ).toBe(false);
  });

  it("derives today attendance status", () => {
    expect(deriveTodayStatus(null)).toBe("missing");
    expect(deriveTodayStatus({ clockOut: null })).toBe("working");
    expect(deriveTodayStatus({ clockOut: "2026-07-26T12:00:00.000Z" })).toBe(
      "recorded",
    );
  });

  it("averages task progress", () => {
    expect(
      computeProjectProgress([
        task({ progressPercentage: 0 }),
        task({ id: "t2", progressPercentage: 50 }),
      ]),
    ).toBe(25);
    expect(computeProjectProgress([])).toBe(0);
  });

  it("marks project health from overdue tasks", () => {
    expect(computeProjectHealth([task()], "2026-07-26")).toBe("overdue");
    expect(
      computeProjectHealth(
        [task({ dueDate: "2026-07-30", status: "in_progress" })],
        "2026-07-26",
      ),
    ).toBe("on_track");
  });

  it("builds metrics, team, projects, and attention lists", () => {
    const result = aggregateLeadershipFromRows({
      today: "2026-07-26",
      weekStart: "2026-07-26",
      weekEnd: "2026-08-01",
      users: [
        {
          userId: "u1",
          fullName: "سارة",
          employeeNumber: "1001",
          avatarUrl: null,
          departmentId: "d1",
          departmentName: "المناهج",
        },
        {
          userId: "u2",
          fullName: "نورة",
          employeeNumber: "1002",
          avatarUrl: null,
          departmentId: "d1",
          departmentName: "المناهج",
        },
      ],
      projects: [
        {
          id: "p1",
          name: "مشروع أ",
          departmentId: "d1",
          departmentName: "المناهج",
          status: "active",
        },
      ],
      tasks: [
        task({
          id: "t1",
          assignedTo: "u1",
          status: "in_progress",
          dueDate: "2026-07-20",
          progressPercentage: 40,
        }),
        task({
          id: "t2",
          assignedTo: "u2",
          status: "todo",
          dueDate: "2026-07-28",
          progressPercentage: 0,
          estimatedHours: 2,
        }),
      ],
      attendance: [
        {
          userId: "u1",
          date: "2026-07-26",
          clockOut: null,
          totalHours: null,
        },
        {
          userId: "u1",
          date: "2026-07-27",
          clockOut: "x",
          totalHours: 7.5,
        },
      ],
    });

    expect(result.metrics.activeProjectsCount).toBe(1);
    expect(result.metrics.inProgressCount).toBe(1);
    expect(result.metrics.overdueCount).toBe(1);
    expect(result.metrics.weekHours).toBe(7.5);
    expect(result.metrics.avgProgressPercent).toBe(20);

    expect(result.overduePeople).toEqual([
      { userId: "u1", fullName: "سارة", overdueCount: 1 },
    ]);
    expect(result.missingAttendanceToday.map((p) => p.userId)).toEqual([
      "u2",
    ]);

    const sarah = result.team.find((r) => r.userId === "u1");
    expect(sarah?.todayStatus).toBe("working");
    expect(sarah?.overdueCount).toBe(1);
    expect(sarah?.inProgressCount).toBe(1);

    expect(result.projects[0]?.health).toBe("overdue");
    expect(result.projects[0]?.estimatedHoursSum).toBe(6);
  });
});
