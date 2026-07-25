import { describe, expect, it } from "vitest";

import { hasPermission, PERMISSIONS } from "@/lib/permissions";

describe("milestone 3 permission codes", () => {
  it("exposes project.view and project.manage", () => {
    expect(PERMISSIONS.PROJECT_VIEW).toBe("project.view");
    expect(PERMISSIONS.PROJECT_MANAGE).toBe("project.manage");
  });

  it("recognizes project.view for employees when granted", () => {
    expect(
      hasPermission("employee", PERMISSIONS.PROJECT_VIEW, ["project.view"]),
    ).toBe(true);
  });

  it("does not treat project.manage as granted to managers by default codes", () => {
    expect(
      hasPermission("department_manager", PERMISSIONS.PROJECT_MANAGE, [
        "project.view",
        "task.create",
        "task.assign",
      ]),
    ).toBe(false);
  });

  it("recognizes manager task.create and task.assign when granted", () => {
    expect(
      hasPermission("department_manager", PERMISSIONS.TASK_CREATE, [
        "project.view",
        "task.create",
        "task.assign",
      ]),
    ).toBe(true);
    expect(
      hasPermission("department_manager", PERMISSIONS.TASK_ASSIGN, [
        "task.assign",
      ]),
    ).toBe(true);
  });
});
