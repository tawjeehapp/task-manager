import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { mapUserRow, type UserRow } from "@/lib/auth/types";
import { toPublicUser } from "@/features/auth/types/auth.types";
import { getManagedDepartmentId } from "@/features/departments/services/membership-helpers";
import type { CurrentDepartmentSummary } from "@/features/departments/types/department.types";
import type {
  ListUsersQuery,
  UserSortBy,
} from "@/features/users/schemas/user.schema";
import type { UsersListResult } from "@/features/users/types/user.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { SYSTEM_ADMIN_EMPLOYEE_NUMBER } from "@/lib/table/constants";

export type ListUsersOptions = ListUsersQuery & {
  /**
   * Restrict to members of the viewer's managed department
   * (used for department managers, including those with user.manage).
   */
  scopeToManagedDepartmentOf?: string;
};

const USER_SORT_COLUMNS: Record<UserSortBy, string> = {
  fullName: "full_name",
  employeeNumber: "employee_number",
  role: "role",
  status: "is_active",
  createdAt: "created_at",
};

const USER_LIST_SELECT =
  "*, department_memberships(is_current, department:departments(id, name, status))";

type UserListRow = UserRow & {
  department_memberships?: Array<{
    is_current: boolean;
    department:
      | { id: string; name: string; status: "active" | "archived" }
      | { id: string; name: string; status: "active" | "archived" }[]
      | null;
  }>;
};

function currentDepartmentFromEmbed(
  row: UserListRow,
): CurrentDepartmentSummary | null {
  const memberships = row.department_memberships ?? [];
  const current = memberships.find((m) => m.is_current);
  if (!current?.department) {
    return null;
  }
  const dept = Array.isArray(current.department)
    ? current.department[0]
    : current.department;
  if (!dept) {
    return null;
  }
  return {
    id: dept.id,
    name: dept.name,
    status: dept.status,
  };
}

async function getCurrentMemberUserIds(departmentId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("department_memberships")
    .select("user_id")
    .eq("department_id", departmentId)
    .eq("is_current", true);

  if (error) {
    throw new ApiError("تعذر جلب أعضاء القسم.", 500, "LIST_MEMBERS_FAILED");
  }

  return (data ?? []).map((row) => row.user_id as string);
}

async function getAllCurrentMemberUserIds(): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("department_memberships")
    .select("user_id")
    .eq("is_current", true);

  if (error) {
    throw new ApiError("تعذر جلب أعضاء الأقسام.", 500, "LIST_MEMBERS_FAILED");
  }

  return (data ?? []).map((row) => row.user_id as string);
}

function emptyResult(query: ListUsersOptions): UsersListResult {
  return {
    items: [],
    total: 0,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: 0,
  };
}

export async function listUsers(
  query: ListUsersOptions,
): Promise<UsersListResult> {
  const admin = createAdminClient();
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  let scopedUserIds: string[] | null = null;
  let excludeUserIds: string[] | null = null;

  if (query.scopeToManagedDepartmentOf) {
    const managedId = await getManagedDepartmentId(
      query.scopeToManagedDepartmentOf,
    );
    if (!managedId) {
      return emptyResult(query);
    }
    scopedUserIds = await getCurrentMemberUserIds(managedId);
  } else if (query.departmentId === "none") {
    excludeUserIds = await getAllCurrentMemberUserIds();
  } else if (query.departmentId) {
    scopedUserIds = await getCurrentMemberUserIds(query.departmentId);
  }

  if (scopedUserIds && scopedUserIds.length === 0) {
    return emptyResult(query);
  }

  const sortColumn = USER_SORT_COLUMNS[query.sortBy] ?? "created_at";
  const ascending = query.sortDir === "asc";

  let builder = admin
    .from("users")
    .select(USER_LIST_SELECT, { count: "exact" })
    .neq("employee_number", SYSTEM_ADMIN_EMPLOYEE_NUMBER)
    .order(sortColumn, { ascending })
    .range(from, to);

  if (scopedUserIds) {
    builder = builder.in("id", scopedUserIds);
  }

  if (excludeUserIds && excludeUserIds.length > 0) {
    builder = builder.not(
      "id",
      "in",
      `(${excludeUserIds.map((id) => `"${id}"`).join(",")})`,
    );
  }

  if (query.role) {
    builder = builder.eq("role", query.role);
  }

  if (query.isActive !== undefined) {
    builder = builder.eq("is_active", query.isActive);
  }

  if (query.search?.trim()) {
    const term = `%${query.search.trim()}%`;
    builder = builder.or(
      `full_name.ilike.${term},employee_number.ilike.${term},phone.ilike.${term}`,
    );
  }

  const { data, error, count } = await builder;

  if (error) {
    throw new ApiError("تعذر جلب المستخدمين.", 500, "LIST_USERS_FAILED");
  }

  const rows = (data ?? []) as unknown as UserListRow[];
  const total = count ?? 0;

  return {
    items: rows.map((row) => ({
      ...toPublicUser(mapUserRow(row)),
      currentDepartment: currentDepartmentFromEmbed(row),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/** Convenience for callers that already have the viewer. */
export async function listUsersForViewer(
  viewer: AppUser,
  query: ListUsersQuery,
  canManageUsers: boolean,
): Promise<UsersListResult> {
  // Only admins get org-wide listing. DMs with user.manage stay department-scoped.
  if (viewer.role === "admin" && canManageUsers) {
    return listUsers(query);
  }

  return listUsers({
    ...query,
    scopeToManagedDepartmentOf: viewer.id,
    departmentId: undefined,
  });
}
