export const REPORT_TYPES = [
  "task-completion",
  "employee-workload",
  "attendance-summary",
  "work-log-summary",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export type ReportListResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type TaskCompletionRow = {
  userId: string;
  fullName: string;
  employeeNumber: string;
  departmentName: string | null;
  completedCount: number;
  totalCount: number;
  completionRate: number;
};

export type EmployeeWorkloadRow = {
  userId: string;
  fullName: string;
  employeeNumber: string;
  departmentName: string | null;
  activeTaskCount: number;
  estimatedHours: number;
};

export type AttendanceSummaryRow = {
  userId: string;
  fullName: string;
  employeeNumber: string;
  departmentName: string | null;
  days: number;
  totalHours: number;
  approvedDays: number;
  pendingDays: number;
  rejectedDays: number;
};

export type WorkLogSummaryRow = {
  userId: string;
  fullName: string;
  employeeNumber: string;
  departmentName: string | null;
  logEntries: number;
  loggedHours: number;
};
