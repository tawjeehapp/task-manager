import "server-only";

import type { Role } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

/** Active user IDs with the given role. */
export async function listUserIdsByRole(role: Role): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("id")
    .eq("role", role)
    .eq("is_active", true);

  return (data ?? []).map((row) => row.id as string);
}
