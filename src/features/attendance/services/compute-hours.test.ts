import { describe, expect, it } from "vitest";

import {
  calendarDateInOrgTimezone,
  computeTotalHours,
  orgLocalDateTimeIso,
} from "@/features/attendance/services/compute-hours";

describe("computeTotalHours", () => {
  it("computes hours minus break rounded to 2 decimals", () => {
    expect(
      computeTotalHours(
        "2026-07-25T06:00:00.000Z",
        "2026-07-25T14:00:00.000Z",
        30,
      ),
    ).toBe(7.5);
  });

  it("rejects invalid range", () => {
    expect(() =>
      computeTotalHours(
        "2026-07-25T14:00:00.000Z",
        "2026-07-25T06:00:00.000Z",
        0,
      ),
    ).toThrow("INVALID_TIME_RANGE");
  });

  it("rejects break exceeding duration", () => {
    expect(() =>
      computeTotalHours(
        "2026-07-25T06:00:00.000Z",
        "2026-07-25T07:00:00.000Z",
        90,
      ),
    ).toThrow("BREAK_EXCEEDS_DURATION");
  });
});

describe("calendarDateInOrgTimezone", () => {
  it("formats YYYY-MM-DD in Asia/Riyadh", () => {
    // 2026-07-25 21:30 UTC = 2026-07-26 00:30 in Riyadh (UTC+3)
    const date = calendarDateInOrgTimezone(
      new Date("2026-07-25T21:30:00.000Z"),
      "Asia/Riyadh",
    );
    expect(date).toBe("2026-07-26");
  });
});

describe("orgLocalDateTimeIso", () => {
  it("builds Asia/Riyadh offset ISO from date and time", () => {
    expect(orgLocalDateTimeIso("2026-07-25", "08:00")).toBe(
      "2026-07-25T08:00:00.000+03:00",
    );
    expect(orgLocalDateTimeIso("2026-07-25", "16:30:00")).toBe(
      "2026-07-25T16:30:00.000+03:00",
    );
  });
});
