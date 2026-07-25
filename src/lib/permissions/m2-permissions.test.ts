import { describe, expect, it } from "vitest";

import { hasPermission, PERMISSIONS } from "@/lib/permissions";

describe("milestone 2 permission grants (app-layer codes)", () => {
  it("exposes department.view", () => {
    expect(PERMISSIONS.DEPARTMENT_VIEW).toBe("department.view");
  });

  it("recognizes department.view when granted", () => {
    expect(
      hasPermission("employee", PERMISSIONS.DEPARTMENT_VIEW, [
        "department.view",
      ]),
    ).toBe(true);
  });

  it("recognizes manager reset password when granted", () => {
    expect(
      hasPermission("department_manager", PERMISSIONS.USER_RESET_PASSWORD, [
        "department.view",
        "user.reset_password",
      ]),
    ).toBe(true);
  });
});
