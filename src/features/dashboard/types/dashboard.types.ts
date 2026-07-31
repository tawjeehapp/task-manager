import type { AttendanceUiState } from "@/features/attendance/types/attendance.types";
import type { Role } from "@/lib/permissions";

export type PendingApprovalsBreakdown = {
  leave: number;
  extension: number;
  excusal: number;
  attendance: number;
  total: number;
};

export type DashboardTaskItem = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  priority: string;
  parentTaskId: string | null;
  parentTitle?: string | null;
  projectName: string | null;
  href: string;
  incompleteDependencyCount?: number;
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

export type EmployeeDashboardMetrics = {
  todo: number;
  inProgress: number;
  blocked: number;
  completed: number;
  weekHours: number;
  overdue: number;
  dueToday: number;
};

export type DashboardAttendanceAllocation = {
  kind: "task" | "general";
  taskId: string | null;
  title: string;
  hours: number;
  reason: string | null;
};

export type DashboardAttendanceItem = {
  id: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  totalHours: number | null;
  status: string;
  uiState: AttendanceUiState;
  allocations: DashboardAttendanceAllocation[];
};

export type LeadershipTodayStatus = "missing" | "working" | "recorded";

export type LeadershipProjectHealth = "on_track" | "overdue";

export type LeadershipMetrics = {
  activeProjectsCount: number;
  avgProgressPercent: number;
  inProgressCount: number;
  overdueCount: number;
  weekHours: number;
};

export type LeadershipOverduePerson = {
  userId: string;
  fullName: string;
  overdueCount: number;
};

export type LeadershipPersonRef = {
  userId: string;
  fullName: string;
};

export type LeadershipAttention = {
  overduePeople: LeadershipOverduePerson[];
  pendingApprovals: PendingApprovalsBreakdown;
  missingAttendanceToday: LeadershipPersonRef[];
};

export type LeadershipTeamRow = {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  employeeNumber: string;
  departmentId: string | null;
  departmentName: string | null;
  openTaskCount: number;
  inProgressCount: number;
  overdueCount: number;
  dueTodayCount: number;
  weekHours: number;
  todayStatus: LeadershipTodayStatus;
  href: string;
};

export type LeadershipProjectRow = {
  id: string;
  name: string;
  departmentId: string | null;
  departmentName: string | null;
  progressPercent: number;
  inProgressCount: number;
  overdueCount: number;
  estimatedHoursSum: number;
  nearestDueDate: string | null;
  health: LeadershipProjectHealth;
  href: string;
};

export type LeadershipDashboardBase = {
  today: string;
  metrics: LeadershipMetrics;
  attention: LeadershipAttention;
  team: LeadershipTeamRow[];
  projects: LeadershipProjectRow[];
};

export type AdminDashboard = LeadershipDashboardBase & {
  role: "admin";
};

export type ManagerDashboard = LeadershipDashboardBase & {
  role: "department_manager";
  managedDepartmentId: string | null;
};

export type EmployeeDashboard = {
  role: "employee";
  today: string;
  metrics: EmployeeDashboardMetrics;
  todayTasks: DashboardTaskItem[];
  weekAttendance: DashboardAttendanceItem[];
  attendanceSummary: DashboardAttendanceSummary;
  myRequests: DashboardRequestItem[];
};

export type DashboardSummary =
  | AdminDashboard
  | ManagerDashboard
  | EmployeeDashboard;

export type DashboardRole = Extract<Role, DashboardSummary["role"]>;

export const DASHBOARD_LIST_LIMIT = 8;
export const ATTENTION_OVERDUE_PEOPLE_LIMIT = 10;
