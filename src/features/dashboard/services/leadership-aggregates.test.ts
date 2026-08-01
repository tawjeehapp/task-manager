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

  it("computes hours-weighted project progress", () => {
    expect(
      computeProjectProgress([
        task({ status: "completed", estimatedHours: 1 }),
        task({ id: "t2", estimatedHours: 9 }),
      ]),
    ).toBe(10);
    expect(
      computeProjectProgress([
        task({ status: "completed", estimatedHours: 2 }),
        task({ id: "t2", status: "completed", estimatedHours: 2 }),
      ]),
    ).toBe(100);
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
        }),
        task({
          id: "t2",
          assignedTo: "u2",
          status: "todo",
          dueDate: "2026-07-28",
          estimatedHours: 2,
        }),
      ],
      attendance: [
        {
          userId: "u1",
          date: "2026-07-26",
          clockOut: null,
          totalHours: null,
          status: "pending",
        },
        {
          userId: "u1",
          date: "2026-07-27",
          clockOut: "x",
          totalHours: 7.5,
          status: "approved",
        },
        {
          userId: "u2",
          date: "2026-07-27",
          clockOut: "x",
          totalHours: 2,
          status: "pending",
        },
        {
          userId: "u2",
          date: "2026-07-28",
          clockOut: "x",
          totalHours: 1,
          status: "rejected",
        },
      ],
    });

    expect(result.metrics.activeProjectsCount).toBe(1);
    expect(result.metrics.todoCount).toBe(1);
    expect(result.metrics.inProgressCount).toBe(1);
    expect(result.metrics.blockedCount).toBe(0);
    expect(result.metrics.completedCount).toBe(0);
    expect(result.metrics.overdueCount).toBe(1);
    expect(result.metrics.weekHours).toBe(10.5);
    expect(result.metrics.weekHoursApproved).toBe(7.5);
    expect(result.metrics.weekHoursPending).toBe(2);
    expect(result.metrics.weekHoursRejected).toBe(1);
    expect(result.metrics.avgProgressPercent).toBe(0);

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
    expect(sarah?.todoCount).toBe(0);
    expect(sarah?.weekHours).toBe(7.5);
    expect(sarah?.weekHoursApproved).toBe(7.5);
    expect(sarah?.weekHoursPending).toBe(0);
    expect(sarah?.weekHoursRejected).toBe(0);

    const nora = result.team.find((r) => r.userId === "u2");
    expect(nora?.todoCount).toBe(1);
    expect(nora?.weekHours).toBe(3);
    expect(nora?.weekHoursApproved).toBe(0);
    expect(nora?.weekHoursPending).toBe(2);
    expect(nora?.weekHoursRejected).toBe(1);

    expect(result.projects[0]?.health).toBe("overdue");
    expect(result.projects[0]?.estimatedHoursSum).toBe(6);
  });
});
