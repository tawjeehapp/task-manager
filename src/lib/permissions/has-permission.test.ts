import { describe, expect, it } from "vitest";

import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions";

describe("hasPermission", () => {
  it("returns true when permission is granted", () => {
    expect(
      hasPermission("admin", PERMISSIONS.USER_MANAGE, [
        "user.manage",
        "user.reset_password",
      ]),
    ).toBe(true);
  });

  it("returns false when permission is missing", () => {
    expect(hasPermission("employee", PERMISSIONS.USER_MANAGE, [])).toBe(false);
    expect(
      hasPermission("department_manager", PERMISSIONS.USER_RESET_PASSWORD, [
        "task.assign",
      ]),
    ).toBe(false);
  });
});
