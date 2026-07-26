import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  currentMonthBounds,
  currentWeekBounds,
  isOrgWeekend,
} from "@/lib/org-calendar";

describe("org calendar helpers", () => {
  it("adds calendar days across month boundaries", () => {
    expect(addCalendarDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addCalendarDays("2026-08-01", -1)).toBe("2026-07-31");
  });

  it("computes current month bounds", () => {
    expect(currentMonthBounds("2026-07-25")).toEqual({
      start: "2026-07-01",
      end: "2026-07-31",
      month: "2026-07",
    });
    expect(currentMonthBounds("2026-12-15")).toEqual({
      start: "2026-12-01",
      end: "2026-12-31",
      month: "2026-12",
    });
  });

  it("computes Sunday–Saturday week bounds", () => {
    // 2026-07-26 is Sunday
    expect(currentWeekBounds("2026-07-26")).toEqual({
      start: "2026-07-26",
      end: "2026-08-01",
    });
    // 2026-07-29 is Wednesday
    expect(currentWeekBounds("2026-07-29")).toEqual({
      start: "2026-07-26",
      end: "2026-08-01",
    });
  });

  it("detects org weekend Fri–Sat", () => {
    expect(isOrgWeekend("2026-07-24")).toBe(true); // Fri
    expect(isOrgWeekend("2026-07-25")).toBe(true); // Sat
    expect(isOrgWeekend("2026-07-26")).toBe(false); // Sun
  });
});
