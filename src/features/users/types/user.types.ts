import type { PublicUser } from "@/features/auth/types/auth.types";
import type { CurrentDepartmentSummary } from "@/features/departments/types/department.types";

export type UserListItem = PublicUser & {
  currentDepartment: CurrentDepartmentSummary | null;
};

export type UsersListResult = {
  items: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
