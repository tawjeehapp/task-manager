import type { Role } from "@/lib/permissions";

export type PendingApprovalsBreakdown = {
  leave: number;
  extension: number;
  excusal: number;
  attendance: number;
  total: number;
};

export type DashboardWorkloadItem = {
  userId: string;
  fullName: string;
  employeeNumber: string;
  activeTaskCount: number;
  estimatedHours: number;
  href: string;
};

export type DashboardProjectItem = {
  id: string;
  name: string;
  status: string;
  href: string;
};

export type DashboardTaskItem = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  projectName: string | null;
  href: string;
};

export type DashboardRequestItem = {
  id: string;
  kind: "leave" | "extension" | "excusal";
  title: string;
  status: string;
  createdAt: string;
  href: string;
};

export type DashboardAttendanceSummary = {
  month: string;
  totalHours: number;
  approvedDays: number;
  pendingDays: number;
  rejectedDays: number;
  href: string;
};

export type AdminDashboard = {
  role: "admin";
  departmentsCount: number;
  activeProjectsCount: number;
  employeesCount: number;
  pendingApprovals: PendingApprovalsBreakdown;
  companyWorkload: DashboardWorkloadItem[];
};

export type ManagerDashboard = {
  role: "department_manager";
  managedDepartmentId: string | null;
  departmentProjects: DashboardProjectItem[];
  overdueTasks: DashboardTaskItem[];
  teamWorkload: DashboardWorkloadItem[];
  pendingApprovals: PendingApprovalsBreakdown;
};

export type EmployeeDashboard = {
  role: "employee";
  assignedTasks: DashboardTaskItem[];
  upcomingDeadlines: DashboardTaskItem[];
  attendanceSummary: DashboardAttendanceSummary;
  myRequests: DashboardRequestItem[];
};

export type DashboardSummary =
  | AdminDashboard
  | ManagerDashboard
  | EmployeeDashboard;

export type DashboardRole = Extract<Role, DashboardSummary["role"]>;

export const DASHBOARD_LIST_LIMIT = 8;
export const UPCOMING_DEADLINE_DAYS = 14;
