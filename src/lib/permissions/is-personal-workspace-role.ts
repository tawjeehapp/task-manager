import type { Role } from "@/lib/permissions";

/** Roles that use the personal employee-style workspace (dashboard, my tasks, etc.). */
export function isPersonalWorkspaceRole(
  role: Role | null | undefined,
): role is "employee" | "department_manager" {
  return role === "employee" || role === "department_manager";
}
