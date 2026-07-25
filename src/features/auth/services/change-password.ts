import "server-only";

import { ApiError } from "@/lib/api/errors";
import { toAuthEmail } from "@/lib/auth/employee-email";
import type { AppUser } from "@/lib/auth/types";
import type { ChangePasswordInput } from "@/features/auth/schemas/auth.schema";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function changePassword(
  user: AppUser,
  input: ChangePasswordInput,
): Promise<void> {
  const supabase = await createClient();

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: toAuthEmail(user.employeeNumber),
    password: input.currentPassword,
  });

  if (reauthError) {
    throw new ApiError(
      "كلمة المرور الحالية غير صحيحة.",
      400,
      "INVALID_CURRENT_PASSWORD",
    );
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: input.newPassword,
  });

  if (updateError) {
    throw new ApiError(
      "تعذر تحديث كلمة المرور.",
      500,
      "PASSWORD_UPDATE_FAILED",
    );
  }

  const admin = createAdminClient();
  const { error: flagError } = await admin
    .from("users")
    .update({ must_change_password: false })
    .eq("id", user.id);

  if (flagError) {
    throw new ApiError(
      "تم تحديث كلمة المرور لكن تعذر تحديث حالة الحساب.",
      500,
      "PROFILE_UPDATE_FAILED",
    );
  }
}
