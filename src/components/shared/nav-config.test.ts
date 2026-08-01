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

const MANAGER_PERMS = [
  "department.view",
  "project.view",
  "attendance.view",
  "attendance.approve",
  "leave.view",
  "leave.approve",
  "employee_request.view",
  "employee_request.create",
  "employee_request.approve",
  "announcement.view",
  "notification.view",
  "report.view",
  "user.reset_password",
  "task.create",
  "task.assign",
  "work_log.create",
  "work_log.view",
];

function allItems() {
  return navSections.flatMap((section) => section.items);
}

describe("navItemIsVisible", () => {
  it("shows employees Dashboard, Projects, Tasks, Attendance & vacations, Announcements, and Notifications", () => {
    const visible = allItems()
      .filter((item) => navItemIsVisible(item, EMPLOYEE_PERMS, "employee"))
      .map((item) => item.key);

    expect(visible).toEqual([
      "dashboard",
      "projects",
      "tasks",
      "attendanceLeave",
      "announcements",
      "notifications",
    ]);
  });

  it("hides Reports, Departments, manager dashboards, team tasks, and requests from employees", () => {
    for (const key of [
      "reports",
      "departments",
      "departmentDashboard",
      "myDashboard",
      "teamTasks",
      "requests",
    ]) {
      const item = allItems().find((entry) => entry.key === key);
      expect(item).toBeDefined();
      expect(navItemIsVisible(item!, EMPLOYEE_PERMS, "employee")).toBe(false);
    }
  });

  it("shows managers department dashboard first, then my dashboard, plus managerial items", () => {
    const visible = allItems()
      .filter((item) =>
        navItemIsVisible(item, MANAGER_PERMS, "department_manager"),
      )
      .map((item) => item.key);

    expect(visible).toEqual([
      "departmentDashboard",
      "myDashboard",
      "projects",
      "tasks",
      "teamTasks",
      "attendanceLeave",
      "departments",
      "employees",
      "requests",
      "announcements",
      "notifications",
      "reports",
    ]);
  });

  it("still shows Projects and Attendance & vacations to managers with permissions", () => {
    const projects = allItems().find((item) => item.key === "projects");
    const attendanceLeave = allItems().find(
      (item) => item.key === "attendanceLeave",
    );
    const reports = allItems().find((item) => item.key === "reports");

    expect(
      navItemIsVisible(projects!, MANAGER_PERMS, "department_manager"),
    ).toBe(true);
    expect(
      navItemIsVisible(attendanceLeave!, MANAGER_PERMS, "department_manager"),
    ).toBe(true);
    expect(navItemIsVisible(reports!, MANAGER_PERMS, "department_manager")).toBe(
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
