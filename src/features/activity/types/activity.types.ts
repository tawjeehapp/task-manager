export type ActivityEntityType = "project" | "department" | "task";

export type ActivityUserSummary = {
  id: string;
  fullName: string;
  employeeNumber: string;
};

export type EntityActivityLog = {
  id: string;
  userId: string;
  user: ActivityUserSummary | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type EntityActivityListResult = {
  items: EntityActivityLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ProjectActivityAction =
  | "project.created"
  | "project.updated"
  | "project.member_added"
  | "project.member_removed";

export type DepartmentActivityAction =
  | "department.updated"
  | "department.member_added"
  | "department.member_removed";
