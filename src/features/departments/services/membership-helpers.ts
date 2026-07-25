import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** True when target has a current membership in a department managed by managerId. */
export async function sharesManagedDepartmentWith(
  managerId: string,
  targetUserId: string,
): Promise<boolean> {
  const admin = createAdminClient();

  const { data: managed } = await admin
    .from("departments")
    .select("id")
    .eq("manager_id", managerId)
    .maybeSingle();

  if (!managed) {
    return false;
  }

  const { data: membership } = await admin
    .from("department_memberships")
    .select("id")
    .eq("department_id", managed.id)
    .eq("user_id", targetUserId)
    .eq("is_current", true)
    .maybeSingle();

  return Boolean(membership);
}

export async function getManagedDepartmentId(
  managerId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("departments")
    .select("id")
    .eq("manager_id", managerId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function getCurrentDepartmentIdForUser(
  userId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("department_memberships")
    .select("department_id")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();
  return data?.department_id ?? null;
}
