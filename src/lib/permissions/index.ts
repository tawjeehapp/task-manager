export const PERMISSIONS = {
  TASK_CREATE: "task.create",
  TASK_ASSIGN: "task.assign",
  ATTENDANCE_VIEW: "attendance.view",
  ATTENDANCE_APPROVE: "attendance.approve",
  WORK_LOG_CREATE: "work_log.create",
  WORK_LOG_VIEW: "work_log.view",
  LEAVE_VIEW: "leave.view",
  LEAVE_MANAGE: "leave.manage",
  LEAVE_APPROVE: "leave.approve",
  EMPLOYEE_REQUEST_VIEW: "employee_request.view",
  EMPLOYEE_REQUEST_CREATE: "employee_request.create",
  EMPLOYEE_REQUEST_APPROVE: "employee_request.approve",
  ANNOUNCEMENT_VIEW: "announcement.view",
  ANNOUNCEMENT_MANAGE: "announcement.manage",
  NOTIFICATION_VIEW: "notification.view",
  DEPARTMENT_MANAGE: "department.manage",
  DEPARTMENT_VIEW: "department.view",
  PROJECT_VIEW: "project.view",
  PROJECT_MANAGE: "project.manage",
  USER_MANAGE: "user.manage",
  USER_RESET_PASSWORD: "user.reset_password",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type Role = "admin" | "department_manager" | "employee";

export { hasPermission } from "@/lib/permissions/has-permission";
