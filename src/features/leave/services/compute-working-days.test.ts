import { describe, expect, it } from "vitest";

import {
  assertSameCalendarYear,
  calendarYear,
  computeWorkingDays,
  remainingForApprove,
  remainingForSubmit,
} from "@/features/leave/services/compute-working-days";

describe("computeWorkingDays", () => {
  it("counts inclusive weekdays and skips Fri-Sat", () => {
    // Sun 2026-07-19 … Thu 2026-07-23 → 5 working days
    expect(computeWorkingDays("2026-07-19", "2026-07-23")).toBe(5);
  });

  it("excludes weekend-only ranges", () => {
    expect(() => computeWorkingDays("2026-07-24", "2026-07-25")).toThrow(
      "ZERO_WORKING_DAYS",
    );
  });

  it("counts a single weekday", () => {
    expect(computeWorkingDays("2026-07-20", "2026-07-20")).toBe(1);
  });

  it("rejects cross-year ranges", () => {
    expect(() => computeWorkingDays("2026-12-30", "2027-01-02")).toThrow(
      "LEAVE_YEAR_MISMATCH",
    );
  });

  it("rejects inverted ranges", () => {
    expect(() => computeWorkingDays("2026-07-23", "2026-07-20")).toThrow(
      "INVALID_DATE_RANGE",
    );
  });
});

describe("year helpers", () => {
  it("extracts calendar year", () => {
    expect(calendarYear("2026-07-25")).toBe(2026);
  });

  it("assertSameCalendarYear passes and fails", () => {
    expect(() => assertSameCalendarYear("2026-01-01", "2026-12-31")).not.toThrow();
    expect(() => assertSameCalendarYear("2026-12-31", "2027-01-01")).toThrow(
      "LEAVE_YEAR_MISMATCH",
    );
  });
});

describe("balance remaining", () => {
  it("submit subtracts used and pending", () => {
    expect(remainingForSubmit(21, 5, 3)).toBe(13);
  });

  it("approve uses committed used only", () => {
    expect(remainingForApprove(21, 5)).toBe(16);
  });
});
