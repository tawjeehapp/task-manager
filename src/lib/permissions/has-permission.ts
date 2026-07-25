import type { Permission, Role } from "@/lib/permissions";

/**
 * Pure permission check against a list of granted permission codes for a role.
 */
export function hasPermission(
  _role: Role,
  permission: Permission,
  grantedCodes: readonly string[],
): boolean {
  return grantedCodes.includes(permission);
}
