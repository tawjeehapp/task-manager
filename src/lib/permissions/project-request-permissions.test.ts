import { describe, expect, it } from "vitest";

import { PERMISSIONS, hasPermission } from "@/lib/permissions";

describe("project_request permissions", () => {
  it("exposes project_request permission codes", () => {
    expect(PERMISSIONS.PROJECT_REQUEST_VIEW).toBe("project_request.view");
    expect(PERMISSIONS.PROJECT_REQUEST_CREATE).toBe("project_request.create");
    expect(PERMISSIONS.PROJECT_REQUEST_APPROVE).toBe(
      "project_request.approve",
    );
  });

  it("allows department managers to create but not approve", () => {
    expect(
      hasPermission("department_manager", PERMISSIONS.PROJECT_REQUEST_CREATE, [
        "project_request.view",
        "project_request.create",
      ]),
    ).toBe(true);
    expect(
      hasPermission("department_manager", PERMISSIONS.PROJECT_REQUEST_APPROVE, [
        "project_request.view",
        "project_request.create",
      ]),
    ).toBe(false);
  });

  it("allows admins to approve", () => {
    expect(
      hasPermission("admin", PERMISSIONS.PROJECT_REQUEST_APPROVE, [
        "project_request.view",
        "project_request.create",
        "project_request.approve",
      ]),
    ).toBe(true);
  });
});
