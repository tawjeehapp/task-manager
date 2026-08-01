import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { mapUserRow, type UserRow } from "@/lib/auth/types";
import { assertCanAccessDepartment } from "@/features/departments/services/assert-can-access-department";
import type {
  CreateDepartmentInput,
  ListDepartmentsQuery,
  UpdateDepartmentInput,
} from "@/features/departments/schemas/department.schema";
import type {
  Department,
  DepartmentManagerSummary,
  DepartmentRow,
} from "@/features/departments/types/department.types";
import { createAdminClient } from "@/lib/supabase/admin";

export type DepartmentsListResult = {
  items: Department[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type DepartmentWithManager = DepartmentRow & {
  manager: {
    id: string;
    full_name: string;
    employee_number: string;
  } | null;
};

function mapManager(
  row: DepartmentWithManager["manager"],
): DepartmentManagerSummary | null {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    fullName: row.full_name,
    employeeNumber: row.employee_number,
  };
}

export function mapDepartment(
  row: DepartmentRow,
  manager: DepartmentManagerSummary | null,
  memberCount: number,
  activeProjectCount = 0,
): Department {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    managerId: row.manager_id,
    manager,
    status: row.status,
    memberCount,
    activeProjectCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getMemberCounts(
  departmentIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (departmentIds.length === 0) {
    return counts;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("department_memberships")
    .select("department_id")
    .in("department_id", departmentIds)
    .eq("is_current", true);

  if (error) {
    throw new ApiError("تعذر حساب أعضاء الأقسام.", 500, "MEMBER_COUNT_FAILED");
  }

  for (const row of data ?? []) {
    const id = row.department_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return counts;
}

async function getActiveProjectCounts(
  departmentIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (departmentIds.length === 0) {
    return counts;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .select("department_id")
    .in("department_id", departmentIds)
    .eq("status", "active");

  if (error) {
    throw new ApiError(
      "تعذر حساب مشاريع الأقسام.",
      500,
      "PROJECT_COUNT_FAILED",
    );
  }

  for (const row of data ?? []) {
    const id = row.department_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return counts;
}

const DEPARTMENT_SELECT =
  "id, name, description, manager_id, status, created_at, updated_at, manager:users!manager_id(id, full_name, employee_number)";

async function loadDepartmentById(id: string): Promise<Department> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("departments")
    .select(DEPARTMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new ApiError("تعذر جلب القسم.", 500, "GET_DEPARTMENT_FAILED");
  }

  if (!data) {
    throw new ApiError("القسم غير موجود.", 404, "DEPARTMENT_NOT_FOUND");
  }

  const row = data as unknown as DepartmentWithManager;
  const [counts, projectCounts] = await Promise.all([
    getMemberCounts([row.id]),
    getActiveProjectCounts([row.id]),
  ]);
  return mapDepartment(
    row,
    mapManager(row.manager),
    counts.get(row.id) ?? 0,
    projectCounts.get(row.id) ?? 0,
  );
}

export async function createDepartment(
  input: CreateDepartmentInput,
): Promise<Department> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("departments")
    .insert({
      name: input.name,
      description: input.description,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new ApiError("تعذر إنشاء القسم.", 500, "CREATE_DEPARTMENT_FAILED");
  }

  return mapDepartment(data as DepartmentRow, null, 0);
}

export { loadDepartmentById };

export async function assignDepartmentManager(
  departmentId: string,
  managerId: string | null,
  replaceExistingManager = false,
): Promise<Department> {
  const admin = createAdminClient();

  const { data: department, error: deptError } = await admin
    .from("departments")
    .select("*")
    .eq("id", departmentId)
    .maybeSingle();

  if (deptError) {
    throw new ApiError("تعذر جلب القسم.", 500, "GET_DEPARTMENT_FAILED");
  }

  if (!department) {
    throw new ApiError("القسم غير موجود.", 404, "DEPARTMENT_NOT_FOUND");
  }

  const dept = department as DepartmentRow;

  if (dept.status === "archived" && managerId !== null) {
    throw new ApiError(
      "لا يمكن تعيين مدير لقسم مؤرشف.",
      409,
      "DEPARTMENT_ARCHIVED",
    );
  }

  if (managerId === null) {
    throw new ApiError(
      "لا يمكن إزالة مدير القسم. استبدله بمدير آخر.",
      409,
      "MANAGER_CLEAR_FORBIDDEN",
    );
  }

  if (dept.manager_id === managerId) {
    return loadDepartmentById(departmentId);
  }

  if (dept.manager_id !== null && !replaceExistingManager) {
    throw new ApiError(
      "القسم لديه مدير حالياً. يجب تأكيد الاستبدال بمدير آخر.",
      409,
      "MANAGER_ALREADY_ASSIGNED",
    );
  }

  const { data: candidate, error: userError } = await admin
    .from("users")
    .select("*")
    .eq("id", managerId)
    .maybeSingle();

  if (userError) {
    throw new ApiError("تعذر جلب المستخدم.", 500, "GET_USER_FAILED");
  }

  if (!candidate) {
    throw new ApiError("المستخدم غير موجود.", 404, "USER_NOT_FOUND");
  }

  const user = mapUserRow(candidate as UserRow);

  if (user.role === "admin") {
    throw new ApiError(
      "لا يمكن تعيين المسؤول رئيساً لقسم.",
      409,
      "ADMIN_CANNOT_MANAGE_DEPARTMENT",
    );
  }

  if (user.role !== "department_manager") {
    throw new ApiError(
      "يجب أن يكون للمستخدم دور مدير قسم قبل تعيينه مديراً.",
      409,
      "INVALID_MANAGER_ROLE",
    );
  }

  if (!user.isActive) {
    throw new ApiError(
      "لا يمكن تعيين مستخدم غير نشط كمدير قسم.",
      409,
      "MANAGER_INACTIVE",
    );
  }

  const { data: otherDept } = await admin
    .from("departments")
    .select("id")
    .eq("manager_id", managerId)
    .neq("id", departmentId)
    .maybeSingle();

  if (otherDept) {
    throw new ApiError(
      "مدير القسم يدير قسماً آخر بالفعل.",
      409,
      "MANAGER_ALREADY_HAS_DEPARTMENT",
    );
  }

  const { error: updateError } = await admin
    .from("departments")
    .update({ manager_id: managerId })
    .eq("id", departmentId);

  if (updateError) {
    if (updateError.code === "23505") {
      throw new ApiError(
        "مدير القسم يدير قسماً آخر بالفعل.",
        409,
        "MANAGER_ALREADY_HAS_DEPARTMENT",
      );
    }
    throw new ApiError(
      "تعذر تعيين مدير القسم.",
      500,
      "ASSIGN_MANAGER_FAILED",
    );
  }

  return loadDepartmentById(departmentId);
}

export async function updateDepartment(
  departmentId: string,
  input: UpdateDepartmentInput,
): Promise<Department> {
  const admin = createAdminClient();

  const { data: existing, error: fetchError } = await admin
    .from("departments")
    .select("*")
    .eq("id", departmentId)
    .maybeSingle();

  if (fetchError) {
    throw new ApiError("تعذر جلب القسم.", 500, "GET_DEPARTMENT_FAILED");
  }

  if (!existing) {
    throw new ApiError("القسم غير موجود.", 404, "DEPARTMENT_NOT_FOUND");
  }

  if (input.managerId !== undefined) {
    await assignDepartmentManager(
      departmentId,
      input.managerId,
      input.replaceExistingManager ?? false,
    );
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    patch.name = input.name;
  }
  if (input.description !== undefined) {
    patch.description = input.description;
  }
  if (input.status !== undefined) {
    patch.status = input.status;
  }

  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await admin
      .from("departments")
      .update(patch)
      .eq("id", departmentId);

    if (updateError) {
      throw new ApiError("تعذر تحديث القسم.", 500, "UPDATE_DEPARTMENT_FAILED");
    }
  }

  return loadDepartmentById(departmentId);
}

export async function deleteDepartment(departmentId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: existing, error: fetchError } = await admin
    .from("departments")
    .select("id")
    .eq("id", departmentId)
    .maybeSingle();

  if (fetchError) {
    throw new ApiError("تعذر جلب القسم.", 500, "GET_DEPARTMENT_FAILED");
  }

  if (!existing) {
    throw new ApiError("القسم غير موجود.", 404, "DEPARTMENT_NOT_FOUND");
  }

  const { count: currentMemberCount, error: membersError } = await admin
    .from("department_memberships")
    .select("id", { count: "exact", head: true })
    .eq("department_id", departmentId)
    .eq("is_current", true);

  if (membersError) {
    throw new ApiError(
      "تعذر التحقق من أعضاء القسم.",
      500,
      "GET_DEPARTMENT_MEMBERS_FAILED",
    );
  }

  if ((currentMemberCount ?? 0) > 0) {
    throw new ApiError(
      "لا يمكن حذف قسم يحتوي على أعضاء حاليين. انقل الأعضاء أو أزلهم أولاً.",
      409,
      "DEPARTMENT_HAS_MEMBERS",
    );
  }

  const { error: historyError } = await admin
    .from("department_memberships")
    .delete()
    .eq("department_id", departmentId);

  if (historyError) {
    throw new ApiError(
      "تعذر حذف سجل عضوية القسم.",
      500,
      "DELETE_DEPARTMENT_MEMBERSHIPS_FAILED",
    );
  }

  const { error: deleteError } = await admin
    .from("departments")
    .delete()
    .eq("id", departmentId);

  if (deleteError) {
    throw new ApiError("تعذر حذف القسم.", 500, "DELETE_DEPARTMENT_FAILED");
  }
}

export async function listDepartmentsForViewer(
  viewer: AppUser,
  options: ListDepartmentsQuery,
): Promise<DepartmentsListResult> {
  if (viewer.role === "employee") {
    throw new ApiError("ليس لديك صلاحية لعرض الأقسام.", 403, "FORBIDDEN");
  }

  const admin = createAdminClient();
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 25;
  const sortBy = options.sortBy ?? "name";
  const sortDir = options.sortDir ?? "asc";

  // memberCount is computed in app layer — sort by name in DB, then reorder if needed
  const dbSortColumn =
    sortBy === "status"
      ? "status"
      : sortBy === "createdAt"
        ? "created_at"
        : "name";

  let builder = admin
    .from("departments")
    .select(DEPARTMENT_SELECT, { count: "exact" })
    .order(dbSortColumn, { ascending: sortDir === "asc" });

  if (options.status) {
    builder = builder.eq("status", options.status);
  } else if (!options.includeArchived) {
    builder = builder.eq("status", "active");
  }

  if (options.managerId === "none") {
    builder = builder.is("manager_id", null);
  } else if (options.managerId) {
    builder = builder.eq("manager_id", options.managerId);
  }

  if (viewer.role === "department_manager") {
    builder = builder.eq("manager_id", viewer.id);
  }

  // For computed sorts, fetch all matching then paginate in memory (small org lists).
  if (sortBy === "memberCount" || sortBy === "activeProjectCount") {
    const { data, error, count } = await builder;
    if (error) {
      throw new ApiError("تعذر جلب الأقسام.", 500, "LIST_DEPARTMENTS_FAILED");
    }
    const rows = (data ?? []) as unknown as DepartmentWithManager[];
    const ids = rows.map((r) => r.id);
    const [counts, projectCounts] = await Promise.all([
      getMemberCounts(ids),
      getActiveProjectCounts(ids),
    ]);
    let items = rows.map((row) =>
      mapDepartment(
        row,
        mapManager(row.manager),
        counts.get(row.id) ?? 0,
        projectCounts.get(row.id) ?? 0,
      ),
    );
    items = items.sort((a, b) => {
      const left =
        sortBy === "memberCount" ? a.memberCount : a.activeProjectCount;
      const right =
        sortBy === "memberCount" ? b.memberCount : b.activeProjectCount;
      return sortDir === "asc" ? left - right : right - left;
    });
    const total = count ?? items.length;
    const from = (page - 1) * pageSize;
    return {
      items: items.slice(from, from + pageSize),
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await builder.range(from, to);

  if (error) {
    throw new ApiError("تعذر جلب الأقسام.", 500, "LIST_DEPARTMENTS_FAILED");
  }

  const rows = (data ?? []) as unknown as DepartmentWithManager[];
  const ids = rows.map((r) => r.id);
  const [counts, projectCounts] = await Promise.all([
    getMemberCounts(ids),
    getActiveProjectCounts(ids),
  ]);
  const total = count ?? 0;

  return {
    items: rows.map((row) =>
      mapDepartment(
        row,
        mapManager(row.manager),
        counts.get(row.id) ?? 0,
        projectCounts.get(row.id) ?? 0,
      ),
    ),
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export async function getDepartmentForViewer(
  viewer: AppUser,
  departmentId: string,
): Promise<Department> {
  await assertCanAccessDepartment(viewer, departmentId);
  return loadDepartmentById(departmentId);
}
