import { describe, expect, it } from "vitest";

import {
  calendarRangeFor,
  monthGridDays,
  shiftFocusDate,
  weekDays,
} from "@/features/dashboard/lib/calendar-range";

describe("calendarRangeFor", () => {
  it("returns single day range", () => {
    expect(calendarRangeFor("day", "2026-07-26")).toEqual({
      dueFrom: "2026-07-26",
      dueTo: "2026-07-26",
    });
  });

  it("returns week range", () => {
    expect(calendarRangeFor("week", "2026-07-29")).toEqual({
      dueFrom: "2026-07-26",
      dueTo: "2026-08-01",
    });
  });

  it("returns month range", () => {
    expect(calendarRangeFor("month", "2026-07-15")).toEqual({
      dueFrom: "2026-07-01",
      dueTo: "2026-07-31",
    });
  });
});

describe("weekDays / monthGridDays / shiftFocusDate", () => {
  it("lists seven week days", () => {
    expect(weekDays("2026-07-29")).toEqual([
      "2026-07-26",
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
    ]);
  });

  it("builds a full Sunday-start month grid", () => {
    const days = monthGridDays("2026-07-15");
    expect(days[0]).toBe("2026-06-28");
    expect(days.at(-1)).toBe("2026-08-01");
    expect(days.length % 7).toBe(0);
  });

  it("shifts focus by view mode", () => {
    expect(shiftFocusDate("day", "2026-07-26", 1)).toBe("2026-07-27");
    expect(shiftFocusDate("week", "2026-07-26", -1)).toBe("2026-07-19");
    expect(shiftFocusDate("month", "2026-07-15", 1)).toBe("2026-08-01");
  });
});
