import { describe, expect, it } from "vitest";

import { hasPermission, PERMISSIONS } from "@/lib/permissions";

describe("milestone 8 permission codes", () => {
  it("exposes report.view", () => {
    expect(PERMISSIONS.REPORT_VIEW).toBe("report.view");
  });

  it("recognizes report.view for admin when granted", () => {
    expect(
      hasPermission("admin", PERMISSIONS.REPORT_VIEW, ["report.view"]),
    ).toBe(true);
  });

  it("recognizes report.view for department managers when granted", () => {
    expect(
      hasPermission("department_manager", PERMISSIONS.REPORT_VIEW, [
        "report.view",
      ]),
    ).toBe(true);
  });

  it("does not grant report.view to employees by code alone", () => {
    expect(
      hasPermission("employee", PERMISSIONS.REPORT_VIEW, [
        "announcement.view",
        "notification.view",
      ]),
    ).toBe(false);
  });
});
