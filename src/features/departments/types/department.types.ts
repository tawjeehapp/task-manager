import type { PublicUser } from "@/features/auth/types/auth.types";

export type DepartmentStatus = "active" | "archived";

export type DepartmentManagerSummary = {
  id: string;
  fullName: string;
  employeeNumber: string;
};

export type Department = {
  id: string;
  name: string;
  description: string | null;
  managerId: string | null;
  manager: DepartmentManagerSummary | null;
  status: DepartmentStatus;
  memberCount: number;
  activeProjectCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DepartmentMembership = {
  id: string;
  departmentId: string;
  userId: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  createdAt: string;
  user?: PublicUser;
};

export type DepartmentRow = {
  id: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  status: DepartmentStatus;
  created_at: string;
  updated_at: string;
};

export type DepartmentMembershipRow = {
  id: string;
  department_id: string;
  user_id: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  created_at: string;
};

export type CurrentDepartmentSummary = {
  id: string;
  name: string;
  status: DepartmentStatus;
};

export type UserWithDepartment = PublicUser & {
  currentDepartment: CurrentDepartmentSummary | null;
};
