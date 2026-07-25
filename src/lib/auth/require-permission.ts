import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { hasPermission, type Permission } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";

export async function requirePermission(
  user: AppUser,
  permission: Permission,
): Promise<string[]> {
  const granted = await getPermissionsForRole(user.role);

  if (!hasPermission(user.role, permission, granted)) {
    throw new ApiError("ليس لديك صلاحية لتنفيذ هذا الإجراء.", 403, "FORBIDDEN");
  }

  return granted;
}
