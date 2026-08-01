import { describe, expect, it } from "vitest";

import {
  computeAvailableHours,
  computeCapacityPercent,
  computeEmployeeCapacity,
  countApprovedLeaveDaysInRange,
} from "@/features/tasks/services/capacity";

describe("countApprovedLeaveDaysInRange", () => {
  it("counts working days covered by leave and skips Fri-Sat", () => {
    // Week Sun 2026-07-19 … Sat 2026-07-25
    const days = countApprovedLeaveDaysInRange("2026-07-19", "2026-07-25", [
      { startDate: "2026-07-20", endDate: "2026-07-22" }, // Mon–Wed
    ]);
    expect(days).toBe(3);
  });

  it("does not double-count overlapping leave ranges", () => {
    const days = countApprovedLeaveDaysInRange("2026-07-19", "2026-07-25", [
      { startDate: "2026-07-20", endDate: "2026-07-21" },
      { startDate: "2026-07-21", endDate: "2026-07-22" },
    ]);
    expect(days).toBe(3);
  });

  it("returns 0 when no leave", () => {
    expect(
      countApprovedLeaveDaysInRange("2026-07-19", "2026-07-25", []),
    ).toBe(0);
  });
});

describe("computeAvailableHours", () => {
  it("returns full capacity with no leave", () => {
    expect(computeAvailableHours(40, 0)).toBe(40);
  });

  it("reduces proportionally for leave days", () => {
    expect(computeAvailableHours(40, 1)).toBe(32);
    expect(computeAvailableHours(40, 5)).toBe(0);
  });
});

describe("computeCapacityPercent", () => {
  it("computes load over available", () => {
    expect(computeCapacityPercent(20, 40)).toBe(50);
  });

  it("returns 100 when available is 0 and load > 0", () => {
    expect(computeCapacityPercent(8, 0)).toBe(100);
  });

  it("returns 0 when available is 0 and load is 0", () => {
    expect(computeCapacityPercent(0, 0)).toBe(0);
  });
});

describe("computeEmployeeCapacity", () => {
  it("excludes blocked and completed from load", () => {
    const result = computeEmployeeCapacity({
      userId: "u1",
      weeklyCapacityHours: 40,
      leaveDaysInWeek: 0,
      tasks: [
        { status: "todo", estimatedHours: 4 },
        { status: "in_progress", estimatedHours: 6 },
        { status: "blocked", estimatedHours: 10 },
        { status: "completed", estimatedHours: 99 },
      ],
    });

    expect(result).toMatchObject({
      userId: "u1",
      activeTaskCount: 2,
      estimatedHours: 10,
      weeklyCapacityHours: 40,
      leaveDaysInWeek: 0,
      availableHours: 40,
      capacityPercent: 25,
    });
  });

  it("accounts for leave in available hours", () => {
    const result = computeEmployeeCapacity({
      userId: "u1",
      weeklyCapacityHours: 40,
      leaveDaysInWeek: 1,
      tasks: [{ status: "in_progress", estimatedHours: 16 }],
    });

    expect(result.availableHours).toBe(32);
    expect(result.capacityPercent).toBe(50);
  });
});
