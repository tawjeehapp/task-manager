export type EmployeeRequestType = "extension" | "excusal";
export type EmployeeRequestStatus = "pending" | "approved" | "rejected";

export type EmployeeRequestUserSummary = {
  id: string;
  fullName: string;
  employeeNumber: string;
};

export type EmployeeRequest = {
  id: string;
  userId: string;
  user: EmployeeRequestUserSummary | null;
  taskId: string;
  taskTitle: string | null;
  type: EmployeeRequestType;
  reason: string | null;
  requestedDate: string | null;
  status: EmployeeRequestStatus;
  reviewedBy: string | null;
  reviewedByUser: EmployeeRequestUserSummary | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeRequestRow = {
  id: string;
  user_id: string;
  task_id: string;
  type: EmployeeRequestType;
  reason: string | null;
  requested_date: string | null;
  status: EmployeeRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string;
    employee_number: string;
  } | null;
  reviewed_by_user?: {
    id: string;
    full_name: string;
    employee_number: string;
  } | null;
  task?: {
    id: string;
    title: string;
  } | null;
};

function mapUser(
  row:
    | {
        id: string;
        full_name: string;
        employee_number: string;
      }
    | null
    | undefined,
): EmployeeRequestUserSummary | null {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    employeeNumber: row.employee_number,
  };
}

export function mapEmployeeRequestRow(row: EmployeeRequestRow): EmployeeRequest {
  return {
    id: row.id,
    userId: row.user_id,
    user: mapUser(row.user),
    taskId: row.task_id,
    taskTitle: row.task?.title ?? null,
    type: row.type,
    reason: row.reason,
    requestedDate: row.requested_date,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedByUser: mapUser(row.reviewed_by_user),
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
