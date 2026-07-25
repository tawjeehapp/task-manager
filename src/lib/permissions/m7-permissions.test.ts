import { describe, expect, it } from "vitest";

import { hasPermission, PERMISSIONS } from "@/lib/permissions";

describe("milestone 7 permission codes", () => {
  it("exposes announcement and notification permissions", () => {
    expect(PERMISSIONS.ANNOUNCEMENT_VIEW).toBe("announcement.view");
    expect(PERMISSIONS.ANNOUNCEMENT_MANAGE).toBe("announcement.manage");
    expect(PERMISSIONS.NOTIFICATION_VIEW).toBe("notification.view");
  });

  it("recognizes announcement.manage for managers when granted", () => {
    expect(
      hasPermission("department_manager", PERMISSIONS.ANNOUNCEMENT_MANAGE, [
        "announcement.view",
        "announcement.manage",
        "notification.view",
      ]),
    ).toBe(true);
  });

  it("does not grant announcement.manage to employees by code alone", () => {
    expect(
      hasPermission("employee", PERMISSIONS.ANNOUNCEMENT_MANAGE, [
        "announcement.view",
        "notification.view",
      ]),
    ).toBe(false);
  });
});
