import { describe, expect, it } from "vitest";

import { hasPermission, PERMISSIONS } from "@/lib/permissions";

describe("milestone 5 permission codes", () => {
  it("exposes attendance and work log permissions", () => {
    expect(PERMISSIONS.ATTENDANCE_VIEW).toBe("attendance.view");
    expect(PERMISSIONS.ATTENDANCE_APPROVE).toBe("attendance.approve");
    expect(PERMISSIONS.WORK_LOG_CREATE).toBe("work_log.create");
    expect(PERMISSIONS.WORK_LOG_VIEW).toBe("work_log.view");
  });

  it("recognizes attendance.approve for managers when granted", () => {
    expect(
      hasPermission("department_manager", PERMISSIONS.ATTENDANCE_APPROVE, [
        "attendance.view",
        "attendance.approve",
      ]),
    ).toBe(true);
  });
});
