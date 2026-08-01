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
  weekHoursApproved: number;
  weekHoursPending: number;
  weekHoursRejected: number;
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
  rejectionReason: string | null;
  allocations: DashboardAttendanceAllocation[];
};

export type DashboardRejectedLeaveItem = {
  id: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  days: number;
  rejectionReason: string | null;
  href: string;
};

export type LeadershipTodayStatus = "missing" | "working" | "recorded";

export type LeadershipProjectHealth = "on_track" | "overdue";

export type LeadershipStatusTiming = {
  overdue: number;
  dueToday: number;
};

export type LeadershipMetrics = {
  activeProjectsCount: number;
  avgProgressPercent: number;
  todoCount: number;
  inProgressCount: number;
  blockedCount: number;
  completedCount: number;
  overdueCount: number;
  dueTodayCount: number;
  todoTiming: LeadershipStatusTiming;
  inProgressTiming: LeadershipStatusTiming;
  blockedTiming: LeadershipStatusTiming;
  completedTiming: LeadershipStatusTiming;
  weekHours: number;
  weekHoursApproved: number;
  weekHoursPending: number;
  weekHoursRejected: number;
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
  todoCount: number;
  inProgressCount: number;
  blockedCount: number;
  completedCount: number;
  overdueCount: number;
  dueTodayCount: number;
  loadHours: number;
  availableHours: number;
  capacityPercent: number;
  weekHours: number;
  weekHoursApproved: number;
  weekHoursPending: number;
  weekHoursRejected: number;
  todayStatus: LeadershipTodayStatus;
  href: string;
};

export type LeadershipProjectRow = {
  id: string;
  name: string;
  departmentId: string | null;
  departmentName: string | null;
  progressPercent: number;
  todoCount: number;
  inProgressCount: number;
  blockedCount: number;
  completedCount: number;
  overdueCount: number;
  dueTodayCount: number;
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

/** Personal (employee-style) dashboard payload. `role` is a view discriminant, not the viewer’s auth role. */
export type EmployeeDashboard = {
  role: "employee";
  today: string;
  metrics: EmployeeDashboardMetrics;
  todayTasks: DashboardTaskItem[];
  /** Open tasks (todo / in_progress / blocked), sorted for a compact dashboard snippet. */
  openTasks: DashboardTaskItem[];
  weekAttendance: DashboardAttendanceItem[];
  rejectedLeave: DashboardRejectedLeaveItem[];
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
