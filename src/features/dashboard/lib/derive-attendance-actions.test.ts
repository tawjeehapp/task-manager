import { describe, expect, it } from "vitest";

import { deriveAttendanceActions } from "@/features/dashboard/lib/derive-attendance-actions";

describe("deriveAttendanceActions", () => {
  it("lists missing working days up to today, skipping weekends", () => {
    // Week of Sun Jul 26 – Sat Aug 1; today Wed Jul 29
    const result = deriveAttendanceActions({
      today: "2026-07-29",
      weekAttendance: [
        {
          id: "1",
          date: "2026-07-26",
          status: "approved",
        },
        {
          id: "2",
          date: "2026-07-28",
          status: "pending",
        },
      ],
    });

    // Sun 26 recorded, Mon 27 missing, Tue 28 recorded, Wed 29 missing
    // Fri/Sat not yet in range (today is Wed)
    expect(result.missingDates).toEqual(["2026-07-27", "2026-07-29"]);
    expect(result.rejected).toEqual([]);
  });

  it("does not treat weekend gaps as missing", () => {
    // Today Saturday Aug 1 — Fri Jul 31 and Sat Aug 1 are weekend
    const result = deriveAttendanceActions({
      today: "2026-08-01",
      weekAttendance: [
        { id: "1", date: "2026-07-26", status: "approved" },
        { id: "2", date: "2026-07-27", status: "approved" },
        { id: "3", date: "2026-07-28", status: "approved" },
        { id: "4", date: "2026-07-29", status: "approved" },
        { id: "5", date: "2026-07-30", status: "approved" },
      ],
    });

    expect(result.missingDates).toEqual([]);
  });

  it("returns rejected records newest first with reason", () => {
    const result = deriveAttendanceActions({
      today: "2026-07-30",
      weekAttendance: [
        {
          id: "a",
          date: "2026-07-28",
          status: "rejected",
          rejectionReason: "Wrong times",
        },
        {
          id: "b",
          date: "2026-07-30",
          status: "rejected",
          rejectionReason: "Missing task",
        },
        {
          id: "c",
          date: "2026-07-29",
          status: "approved",
        },
      ],
    });

    expect(result.rejected.map((r) => r.id)).toEqual(["b", "a"]);
    expect(result.rejected[0]?.rejectionReason).toBe("Missing task");
    // 26, 27 missing (working days before first records); 28/29/30 have records
    expect(result.missingDates).toEqual(["2026-07-26", "2026-07-27"]);
  });
});
