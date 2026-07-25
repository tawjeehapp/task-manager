import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/permissions";

type RolePermissionRow = {
  permissions: { code: string } | { code: string }[] | null;
};

function extractCodes(rows: RolePermissionRow[] | null): string[] {
  if (!rows) {
    return [];
  }

  const codes: string[] = [];
  for (const row of rows) {
    const perm = row.permissions;
    if (!perm) {
      continue;
    }
    if (Array.isArray(perm)) {
      for (const p of perm) {
        codes.push(p.code);
      }
    } else {
      codes.push(perm.code);
    }
  }
  return codes;
}

/**
 * Loads permission codes granted to a role from role_permissions.
 */
export async function getPermissionsForRole(role: Role): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permissions(code)")
    .eq("role", role);

  if (error) {
    // Fall back to service role if RLS/session cannot read (e.g. during login)
    return getPermissionsForRoleAsAdmin(role);
  }

  return extractCodes(data as RolePermissionRow[] | null);
}

export async function getPermissionsForRoleAsAdmin(
  role: Role,
): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("role_permissions")
    .select("permissions(code)")
    .eq("role", role);

  if (error || !data) {
    return [];
  }

  return extractCodes(data as RolePermissionRow[]);
}
