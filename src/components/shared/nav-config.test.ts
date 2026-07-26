import { describe, expect, it } from "vitest";

import {
  mobileNavItems,
  navItemIsVisible,
  navSections,
} from "@/components/shared/nav-config";

const EMPLOYEE_PERMS = [
  "department.view",
  "project.view",
  "attendance.view",
  "leave.view",
  "announcement.view",
  "notification.view",
  "employee_request.view",
  "employee_request.create",
  "work_log.create",
  "work_log.view",
];

function allItems() {
  return navSections.flatMap((section) => section.items);
}

describe("navItemIsVisible", () => {
  it("shows employees only Dashboard, Tasks, and Notifications", () => {
    const visible = allItems()
      .filter((item) => navItemIsVisible(item, EMPLOYEE_PERMS, "employee"))
      .map((item) => item.key);

    expect(visible).toEqual(["dashboard", "tasks", "notifications"]);
  });

  it("hides Projects, Departments, Attendance, Leave, Announcements, and Reports from employees", () => {
    for (const key of [
      "projects",
      "departments",
      "attendance",
      "leave",
      "announcements",
      "reports",
    ]) {
      const item = allItems().find((entry) => entry.key === key);
      expect(item).toBeDefined();
      expect(navItemIsVisible(item!, EMPLOYEE_PERMS, "employee")).toBe(false);
    }
  });

  it("still shows Projects and Attendance to managers with permissions", () => {
    const managerPerms = [
      "project.view",
      "attendance.view",
      "leave.view",
      "leave.approve",
      "department.view",
      "announcement.view",
      "notification.view",
      "report.view",
    ];
    const projects = allItems().find((item) => item.key === "projects");
    const attendance = allItems().find((item) => item.key === "attendance");
    const reports = allItems().find((item) => item.key === "reports");

    expect(navItemIsVisible(projects!, managerPerms, "department_manager")).toBe(
      true,
    );
    expect(
      navItemIsVisible(attendance!, managerPerms, "department_manager"),
    ).toBe(true);
    expect(navItemIsVisible(reports!, managerPerms, "department_manager")).toBe(
      true,
    );
  });

  it("mobile nav is Dashboard, Tasks, Notifications", () => {
    expect(mobileNavItems.map((item) => item.key)).toEqual([
      "dashboard",
      "tasks",
      "notifications",
    ]);
  });
});
