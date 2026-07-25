import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { mapUserRow, type UserRow } from "@/lib/auth/types";
import { toPublicUser } from "@/features/auth/types/auth.types";
import type { CurrentDepartmentSummary } from "@/features/departments/types/department.types";
import { assertCanViewUser } from "@/features/users/services/assert-can-view-user";
import type { UserListItem } from "@/features/users/types/user.types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getUserById(
  viewer: AppUser,
  id: string,
): Promise<UserListItem> {
  await assertCanViewUser(viewer, id);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new ApiError("تعذر جلب المستخدم.", 500, "GET_USER_FAILED");
  }

  if (!data) {
    throw new ApiError("المستخدم غير موجود.", 404, "USER_NOT_FOUND");
  }

  const { data: membership } = await admin
    .from("department_memberships")
    .select("department:departments!inner(id, name, status)")
    .eq("user_id", id)
    .eq("is_current", true)
    .maybeSingle();

  let currentDepartment: CurrentDepartmentSummary | null = null;
  if (membership?.department) {
    const dept = membership.department as unknown as {
      id: string;
      name: string;
      status: "active" | "archived";
    };
    currentDepartment = {
      id: dept.id,
      name: dept.name,
      status: dept.status,
    };
  }

  return {
    ...toPublicUser(mapUserRow(data as UserRow)),
    currentDepartment,
  };
}
