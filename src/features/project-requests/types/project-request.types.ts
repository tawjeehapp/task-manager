export type ProjectRequestType = "extension";
export type ProjectRequestStatus = "pending" | "approved" | "rejected";

export type ProjectRequestUserSummary = {
  id: string;
  fullName: string;
  employeeNumber: string;
};

export type ProjectRequest = {
  id: string;
  userId: string;
  user: ProjectRequestUserSummary | null;
  projectId: string;
  projectName: string | null;
  projectEndDate: string | null;
  type: ProjectRequestType;
  reason: string | null;
  requestedDate: string;
  status: ProjectRequestStatus;
  reviewedBy: string | null;
  reviewedByUser: ProjectRequestUserSummary | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRequestRow = {
  id: string;
  user_id: string;
  project_id: string;
  type: ProjectRequestType;
  reason: string | null;
  requested_date: string;
  status: ProjectRequestStatus;
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
  project?: {
    id: string;
    name: string;
    end_date: string;
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
): ProjectRequestUserSummary | null {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    employeeNumber: row.employee_number,
  };
}

export function mapProjectRequestRow(row: ProjectRequestRow): ProjectRequest {
  return {
    id: row.id,
    userId: row.user_id,
    user: mapUser(row.user),
    projectId: row.project_id,
    projectName: row.project?.name ?? null,
    projectEndDate: row.project?.end_date ?? null,
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
