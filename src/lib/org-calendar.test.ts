import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  currentMonthBounds,
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
});
