import "server-only";

import { ApiError } from "@/lib/api/errors";
import { mapUserRow, type UserRow } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

function isWeakPasswordError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("password") &&
    (normalized.includes("weak") ||
      normalized.includes("least") ||
      normalized.includes("short") ||
      normalized.includes("characters") ||
      normalized.includes("pwned") ||
      normalized.includes("leaked") ||
      normalized.includes("strength"))
  );
}

/**
 * Resets Auth password to the employee number and forces password change.
 * Never returns the password.
 *
 * Supabase Auth enforces password strength on admin `updateUserById`, but not
 * on `createUser`. Employee-number temps are only 4 digits, so when update is
 * rejected we recreate the Auth user (create path) and re-point the profile.
 */
export async function resetUserPassword(id: string): Promise<void> {
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

  const user = mapUserRow(existing as UserRow);
  const temporaryPassword = user.employeeNumber;

  const { error: authError } = await admin.auth.admin.updateUserById(
    user.authUserId,
    { password: temporaryPassword },
  );

  if (!authError) {
    const { error: flagError } = await admin
      .from("users")
      .update({ must_change_password: true })
      .eq("id", id);

    if (flagError) {
      throw new ApiError(
        "تم إعادة التعيين لكن تعذر تحديث حالة الحساب.",
        500,
        "PROFILE_UPDATE_FAILED",
      );
    }
    return;
  }

  if (!isWeakPasswordError(authError.message)) {
    throw new ApiError(
      `تعذر إعادة تعيين كلمة المرور: ${authError.message}`,
      500,
      "PASSWORD_RESET_FAILED",
    );
  }

  await resetPasswordByRecreatingAuthUser(user, temporaryPassword);
}

async function resetPasswordByRecreatingAuthUser(
  user: ReturnType<typeof mapUserRow>,
  temporaryPassword: string,
): Promise<void> {
  const admin = createAdminClient();
  const tempEmail = `${user.employeeNumber}+reset-${Date.now()}@task-manager.com`;

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: tempEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        employee_number: user.employeeNumber,
        full_name: user.fullName,
      },
    });

  if (createError || !created.user) {
    throw new ApiError(
      `تعذر إعادة تعيين كلمة المرور: ${createError?.message ?? "create failed"}`,
      500,
      "PASSWORD_RESET_FAILED",
    );
  }

  const newAuthUserId = created.user.id;
  const previousAuthUserId = user.authUserId;

  const { error: relinkError } = await admin
    .from("users")
    .update({
      auth_user_id: newAuthUserId,
      must_change_password: true,
    })
    .eq("id", user.id);

  if (relinkError) {
    await admin.auth.admin.deleteUser(newAuthUserId);
    throw new ApiError(
      "تعذر ربط حساب المصادقة الجديد.",
      500,
      "PROFILE_UPDATE_FAILED",
    );
  }

  const { error: deleteOldError } =
    await admin.auth.admin.deleteUser(previousAuthUserId);

  if (deleteOldError) {
    // Profile already points at the new auth user; old auth user is orphaned.
    // Continue — password reset still succeeded for the linked account.
  }

  const { error: emailError } = await admin.auth.admin.updateUserById(
    newAuthUserId,
    { email: user.email, email_confirm: true },
  );

  if (emailError) {
    throw new ApiError(
      `تم إعادة التعيين لكن تعذر تحديث البريد الاصطناعي: ${emailError.message}`,
      500,
      "PASSWORD_RESET_PARTIAL",
    );
  }
}
