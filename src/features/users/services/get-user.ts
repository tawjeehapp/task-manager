import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { mapUserRow, type UserRow } from "@/lib/auth/types";
import { toPublicUser } from "@/features/auth/types/auth.types";
import { assertCanViewUser } from "@/features/users/services/assert-can-view-user";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getUserById(viewer: AppUser, id: string) {
  assertCanViewUser(viewer, id);

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

  return toPublicUser(mapUserRow(data as UserRow));
}
