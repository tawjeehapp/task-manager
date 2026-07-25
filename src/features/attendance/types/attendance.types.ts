export const ATTENDANCE_TIMEZONE = "Asia/Riyadh";

export type AttendanceStatus = "pending" | "approved" | "rejected";

/** UI-oriented lifecycle state derived from status + clock_out. */
export type AttendanceUiState =
  | "currently_working"
  | "awaiting_approval"
  | "approved"
  | "rejected";

export type AttendanceRecord = {
  id: string;
  userId: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  breakMinutes: number;
  totalHours: number | null;
  status: AttendanceStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  uiState: AttendanceUiState;
  user?: {
    id: string;
    fullName: string;
    employeeNumber: string;
  } | null;
  approvedByUser?: {
    id: string;
    fullName: string;
    employeeNumber: string;
  } | null;
};

export type AttendanceRow = {
  id: string;
  user_id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  total_hours: number | string | null;
  status: AttendanceStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string;
    employee_number: string;
  } | null;
  approved_by_user?: {
    id: string;
    full_name: string;
    employee_number: string;
  } | null;
};

export function deriveAttendanceUiState(
  status: AttendanceStatus,
  clockOut: string | null,
): AttendanceUiState {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (clockOut == null) return "currently_working";
  return "awaiting_approval";
}

export function mapAttendanceRow(row: AttendanceRow): AttendanceRecord {
  const totalHours =
    row.total_hours === null || row.total_hours === undefined
      ? null
      : Number(row.total_hours);

  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    clockIn: row.clock_in,
    clockOut: row.clock_out,
    breakMinutes: row.break_minutes,
    totalHours,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    uiState: deriveAttendanceUiState(row.status, row.clock_out),
    user: row.user
      ? {
          id: row.user.id,
          fullName: row.user.full_name,
          employeeNumber: row.user.employee_number,
        }
      : null,
    approvedByUser: row.approved_by_user
      ? {
          id: row.approved_by_user.id,
          fullName: row.approved_by_user.full_name,
          employeeNumber: row.approved_by_user.employee_number,
        }
      : null,
  };
}
