import "server-only";

import { ApiError } from "@/lib/api/errors";
import { toAuthEmail } from "@/lib/auth/employee-email";
import { mapUserRow, type UserRow } from "@/lib/auth/types";
import { toPublicUser } from "@/features/auth/types/auth.types";
import type { CreateUserInput } from "@/features/users/schemas/user.schema";
import { createAdminClient } from "@/lib/supabase/admin";

export { assertCanViewUser } from "@/features/users/services/assert-can-view-user";

/**
 * Compensating create: Auth user → profile.
 * If profile insert fails, delete the Auth user.
 * Password is the employee number and is never returned.
 */
export async function createUser(input: CreateUserInput) {
  const admin = createAdminClient();
  const email = toAuthEmail(input.employeeNumber);
  const temporaryPassword = input.employeeNumber;

  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("employee_number", input.employeeNumber)
    .maybeSingle();

  if (existing) {
    throw new ApiError(
      "رقم الموظف مستخدم مسبقاً.",
      409,
      "EMPLOYEE_NUMBER_EXISTS",
    );
  }

  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        employee_number: input.employeeNumber,
        full_name: input.fullName,
      },
    });

  if (authError || !authData.user) {
    throw new ApiError(
      "تعذر إنشاء حساب المصادقة.",
      500,
      "AUTH_CREATE_FAILED",
    );
  }

  const authUserId = authData.user.id;

  const { data: profile, error: profileError } = await admin
    .from("users")
    .insert({
      auth_user_id: authUserId,
      employee_number: input.employeeNumber,
      full_name: input.fullName,
      email,
      phone: input.phone ?? null,
      role: input.role,
      is_active: true,
      must_change_password: true,
    })
    .select("*")
    .single();

  if (profileError || !profile) {
    await admin.auth.admin.deleteUser(authUserId);
    throw new ApiError(
      "تعذر إنشاء ملف المستخدم.",
      500,
      "PROFILE_CREATE_FAILED",
    );
  }

  return toPublicUser(mapUserRow(profile as UserRow));
}

export async function countActiveAdmins(): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true);

  if (error) {
    throw new ApiError("تعذر التحقق من المسؤولين.", 500, "ADMIN_COUNT_FAILED");
  }

  return count ?? 0;
}
