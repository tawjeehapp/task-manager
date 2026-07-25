import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { getCurrentDepartmentIdForUser } from "@/features/departments/services/membership-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Viewer may access a department if admin, manages it, or is a current member.
 */
export async function assertCanAccessDepartment(
  viewer: AppUser,
  departmentId: string,
): Promise<void> {
  if (viewer.role === "admin") {
    return;
  }

  const admin = createAdminClient();
  const { data: department, error } = await admin
    .from("departments")
    .select("id, manager_id")
    .eq("id", departmentId)
    .maybeSingle();

  if (error) {
    throw new ApiError("تعذر التحقق من صلاحية القسم.", 500, "ACCESS_CHECK_FAILED");
  }

  if (!department) {
    throw new ApiError("القسم غير موجود.", 404, "DEPARTMENT_NOT_FOUND");
  }

  if (department.manager_id === viewer.id) {
    return;
  }

  const currentDeptId = await getCurrentDepartmentIdForUser(viewer.id);
  if (currentDeptId === departmentId) {
    return;
  }

  throw new ApiError("ليس لديك صلاحية لعرض هذا القسم.", 403, "FORBIDDEN");
}
