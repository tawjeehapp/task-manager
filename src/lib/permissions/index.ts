export const PERMISSIONS = {
  TASK_CREATE: "task.create",
  TASK_ASSIGN: "task.assign",
  ATTENDANCE_APPROVE: "attendance.approve",
  LEAVE_APPROVE: "leave.approve",
  DEPARTMENT_MANAGE: "department.manage",
  DEPARTMENT_VIEW: "department.view",
  USER_MANAGE: "user.manage",
  USER_RESET_PASSWORD: "user.reset_password",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type Role = "admin" | "department_manager" | "employee";

export { hasPermission } from "@/lib/permissions/has-permission";
