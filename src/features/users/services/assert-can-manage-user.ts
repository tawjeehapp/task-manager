import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { mapUserRow, type UserRow } from "@/lib/auth/types";
import { sharesManagedDepartmentWith } from "@/features/departments/services/membership-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin may manage any user.
 * Department manager may manage current employees in their managed department only
 * (not admins, not other managers, not outsiders).
 */
export async function assertCanManageUser(
  actor: AppUser,
  targetId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("*")
    .eq("id", targetId)
    .maybeSingle();

  if (error) {
    throw new ApiError("تعذر جلب المستخدم.", 500, "GET_USER_FAILED");
  }

  if (!data) {
    throw new ApiError("المستخدم غير موجود.", 404, "USER_NOT_FOUND");
  }

  const target = mapUserRow(data as UserRow);

  if (actor.role === "admin") {
    return;
  }

  if (actor.role === "department_manager") {
    if (target.role !== "employee") {
      throw new ApiError(
        "ليس لديك صلاحية إدارة هذا المستخدم.",
        403,
        "FORBIDDEN",
      );
    }

    const shares = await sharesManagedDepartmentWith(actor.id, targetId);
    if (shares) {
      return;
    }
  }

  throw new ApiError(
    "ليس لديك صلاحية إدارة هذا المستخدم.",
    403,
    "FORBIDDEN",
  );
}
