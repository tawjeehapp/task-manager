import { describe, expect, it } from "vitest";

import { hasPermission, PERMISSIONS } from "@/lib/permissions";

describe("milestone 6 permission codes", () => {
  it("exposes leave and employee request permissions", () => {
    expect(PERMISSIONS.LEAVE_VIEW).toBe("leave.view");
    expect(PERMISSIONS.LEAVE_MANAGE).toBe("leave.manage");
    expect(PERMISSIONS.LEAVE_APPROVE).toBe("leave.approve");
    expect(PERMISSIONS.EMPLOYEE_REQUEST_VIEW).toBe("employee_request.view");
    expect(PERMISSIONS.EMPLOYEE_REQUEST_CREATE).toBe(
      "employee_request.create",
    );
    expect(PERMISSIONS.EMPLOYEE_REQUEST_APPROVE).toBe(
      "employee_request.approve",
    );
  });

  it("recognizes leave.approve for managers when granted", () => {
    expect(
      hasPermission("department_manager", PERMISSIONS.LEAVE_APPROVE, [
        "leave.view",
        "leave.approve",
      ]),
    ).toBe(true);
  });

  it("does not grant leave.manage to employees by code alone", () => {
    expect(
      hasPermission("employee", PERMISSIONS.LEAVE_MANAGE, ["leave.view"]),
    ).toBe(false);
  });
});
