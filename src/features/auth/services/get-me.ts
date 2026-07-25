import "server-only";

import type { AppUser } from "@/lib/auth/types";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { toPublicUser } from "@/features/auth/types/auth.types";

export async function getMe(user: AppUser) {
  const permissions = await getPermissionsForRole(user.role);

  return {
    user: toPublicUser(user),
    permissions,
  };
}
