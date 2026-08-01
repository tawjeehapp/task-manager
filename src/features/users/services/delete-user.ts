import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { mapUserRow, type UserRow } from "@/lib/auth/types";
import { countActiveAdmins } from "@/features/users/services/create-user";
import { createAdminClient } from "@/lib/supabase/admin";

export async function deleteUser(actor: AppUser, id: string): Promise<void> {
  if (actor.id === id) {
    throw new ApiError("لا يمكنك حذف حسابك.", 400, "CANNOT_DELETE_SELF");
  }

  const admin = createAdminClient();

  const { data: existing, error: fetchError } = await admin
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    throw new ApiError("تعذر جلب المستخدم.", 500, "GET_USER_FAILED");
  }

  if (!existing) {
    throw new ApiError("المستخدم غير موجود.", 404, "USER_NOT_FOUND");
  }

  const target = mapUserRow(existing as UserRow);

  if (target.role === "admin" && target.isActive) {
    const adminCount = await countActiveAdmins();
    if (adminCount <= 1) {
      throw new ApiError(
        "لا يمكن حذف آخر مسؤول نشط.",
        409,
        "LAST_ADMIN",
      );
    }
  }

  const { data: managedDept, error: managedError } = await admin
    .from("departments")
    .select("id")
    .eq("manager_id", id)
    .maybeSingle();

  if (managedError) {
    throw new ApiError("تعذر التحقق من إدارة القسم.", 500, "GET_DEPARTMENT_FAILED");
  }

  if (managedDept) {
    throw new ApiError(
      "لا يمكن حذف مدير القسم قبل استبداله بمدير آخر.",
      409,
      "USER_MANAGES_DEPARTMENT",
    );
  }

  const { error: deleteProfileError } = await admin
    .from("users")
    .delete()
    .eq("id", id);

  if (deleteProfileError) {
    throw new ApiError("تعذر حذف المستخدم.", 500, "DELETE_USER_FAILED");
  }

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(
    target.authUserId,
  );

  if (deleteAuthError) {
    throw new ApiError(
      "تم حذف الملف لكن تعذر حذف حساب المصادقة.",
      500,
      "AUTH_DELETE_FAILED",
    );
  }
}
