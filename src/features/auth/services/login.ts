import "server-only";

import { ApiError } from "@/lib/api/errors";
import { toAuthEmail } from "@/lib/auth/employee-email";
import { mapUserRow, type AppUser, type UserRow } from "@/lib/auth/types";
import type { LoginInput } from "@/features/auth/schemas/auth.schema";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function loginWithEmployeeNumber(
  input: LoginInput,
): Promise<AppUser> {
  const supabase = await createClient();
  const email = toAuthEmail(input.employeeNumber);

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password: input.password,
    });

  if (authError || !authData.user) {
    throw new ApiError(
      "رقم الموظف أو كلمة المرور غير صحيحة.",
      401,
      "INVALID_CREDENTIALS",
    );
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("*")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    throw new ApiError(
      "تعذر العثور على ملف المستخدم.",
      500,
      "PROFILE_NOT_FOUND",
    );
  }

  const user = mapUserRow(profile as UserRow);

  if (!user.isActive) {
    await supabase.auth.signOut();
    throw new ApiError("الحساب غير نشط.", 403, "ACCOUNT_INACTIVE");
  }

  return user;
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new ApiError("تعذر تسجيل الخروج.", 500, "LOGOUT_FAILED");
  }
}
