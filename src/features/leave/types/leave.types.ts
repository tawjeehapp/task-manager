export const LEAVE_TIMEZONE = "Asia/Riyadh";

export type LeaveRequestStatus = "pending" | "approved" | "rejected";

export type LeaveUserSummary = {
  id: string;
  fullName: string;
  employeeNumber: string;
};

export type LeaveType = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LeaveBalance = {
  id: string;
  userId: string;
  user: LeaveUserSummary | null;
  leaveTypeId: string;
  leaveType: Pick<LeaveType, "id" | "name" | "isActive"> | null;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  year: number;
  createdAt: string;
  updatedAt: string;
};

export type LeaveRequest = {
  id: string;
  userId: string;
  user: LeaveUserSummary | null;
  leaveTypeId: string;
  leaveType: Pick<LeaveType, "id" | "name" | "isActive"> | null;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: LeaveRequestStatus;
  approvedBy: string | null;
  approvedByUser: LeaveUserSummary | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeaveTypeRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LeaveUserRow = {
  id: string;
  full_name: string;
  employee_number: string;
} | null;

export type LeaveBalanceRow = {
  id: string;
  user_id: string;
  leave_type_id: string;
  allocated_days: number;
  used_days: number;
  year: number;
  created_at: string;
  updated_at: string;
  user?: LeaveUserRow;
  leave_type?: {
    id: string;
    name: string;
    is_active: boolean;
  } | null;
};

export type LeaveRequestRow = {
  id: string;
  user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: LeaveRequestStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  user?: LeaveUserRow;
  leave_type?: {
    id: string;
    name: string;
    is_active: boolean;
  } | null;
  approved_by_user?: LeaveUserRow;
};

function mapUser(row: LeaveUserRow): LeaveUserSummary | null {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    employeeNumber: row.employee_number,
  };
}

export function mapLeaveTypeRow(row: LeaveTypeRow): LeaveType {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLeaveBalanceRow(
  row: LeaveBalanceRow,
  pendingDays = 0,
): LeaveBalance {
  const remaining = Math.max(
    0,
    row.allocated_days - row.used_days - pendingDays,
  );
  return {
    id: row.id,
    userId: row.user_id,
    user: mapUser(row.user ?? null),
    leaveTypeId: row.leave_type_id,
    leaveType: row.leave_type
      ? {
          id: row.leave_type.id,
          name: row.leave_type.name,
          isActive: row.leave_type.is_active,
        }
      : null,
    allocatedDays: row.allocated_days,
    usedDays: row.used_days,
    pendingDays,
    remainingDays: remaining,
    year: row.year,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLeaveRequestRow(row: LeaveRequestRow): LeaveRequest {
  return {
    id: row.id,
    userId: row.user_id,
    user: mapUser(row.user ?? null),
    leaveTypeId: row.leave_type_id,
    leaveType: row.leave_type
      ? {
          id: row.leave_type.id,
          name: row.leave_type.name,
          isActive: row.leave_type.is_active,
        }
      : null,
    startDate: row.start_date,
    endDate: row.end_date,
    days: row.days,
    reason: row.reason,
    status: row.status,
    approvedBy: row.approved_by,
    approvedByUser: mapUser(row.approved_by_user ?? null),
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
