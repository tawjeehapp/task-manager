import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { mapUserRow, type UserRow } from "@/lib/auth/types";
import { toPublicUser } from "@/features/auth/types/auth.types";
import type { UpdateUserInput } from "@/features/users/schemas/user.schema";
import { countActiveAdmins } from "@/features/users/services/create-user";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateUser(
  actor: AppUser,
  id: string,
  input: UpdateUserInput,
) {
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

  const current = mapUserRow(existing as UserRow);

  const nextRole = input.role ?? current.role;
  const nextActive = input.isActive ?? current.isActive;

  const demotingOrDeactivatingLastAdmin =
    current.role === "admin" &&
    current.isActive &&
    (nextRole !== "admin" || nextActive === false);

  if (demotingOrDeactivatingLastAdmin) {
    const adminCount = await countActiveAdmins();
    if (adminCount <= 1) {
      throw new ApiError(
        "لا يمكن تعطيل أو تغيير دور آخر مسؤول نشط.",
        409,
        "LAST_ADMIN",
      );
    }
  }

  if (actor.id === id && input.isActive === false) {
    throw new ApiError("لا يمكنك تعطيل حسابك.", 400, "CANNOT_DEACTIVATE_SELF");
  }

  const { data, error } = await admin
    .from("users")
    .update({
      ...(input.fullName !== undefined ? { full_name: input.fullName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new ApiError("تعذر تحديث المستخدم.", 500, "UPDATE_USER_FAILED");
  }

  return toPublicUser(mapUserRow(data as UserRow));
}
