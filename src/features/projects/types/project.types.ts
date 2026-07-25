export type ProjectStatus = "draft" | "active" | "completed" | "archived";
export type ProjectPriority = "low" | "medium" | "high";

export type ProjectDepartmentSummary = {
  id: string;
  name: string;
};

export type ProjectUserSummary = {
  id: string;
  fullName: string;
  employeeNumber: string;
};

export type Project = {
  id: string;
  departmentId: string;
  department: ProjectDepartmentSummary | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string | null;
  endDate: string | null;
  createdBy: string;
  createdByUser: ProjectUserSummary | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectMember = {
  id: string;
  projectId: string;
  userId: string;
  createdAt: string;
  user: ProjectUserSummary | null;
};

export type ProjectRow = {
  id: string;
  department_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  start_date: string | null;
  end_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ProjectMemberRow = {
  id: string;
  project_id: string;
  user_id: string;
  created_at: string;
};
