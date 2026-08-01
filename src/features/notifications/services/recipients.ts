import "server-only";

import {
  getCurrentDepartmentIdForUser,
  getManagedDepartmentId,
} from "@/features/departments/services/membership-helpers";
import { ApiError } from "@/lib/api/errors";
import type { Role } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

/** Active admin user IDs (excluding optional actor). */
export async function listAdminUserIds(
  excludeUserId?: string,
): Promise<string[]> {
  const admin = createAdminClient();
  let q = admin
    .from("users")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);

  if (excludeUserId) {
    q = q.neq("id", excludeUserId);
  }

  const { data } = await q;
  return (data ?? []).map((row) => row.id as string);
}

/** Department manager for a department, if active. */
export async function getDepartmentManagerUserId(
  departmentId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("departments")
    .select("manager_id")
    .eq("id", departmentId)
    .maybeSingle();

  if (!data?.manager_id) {
    return null;
  }

  const { data: user } = await admin
    .from("users")
    .select("id")
    .eq("id", data.manager_id)
    .eq("is_active", true)
    .maybeSingle();

  return user?.id ?? null;
}

/**
 * Notification recipients for approval requests.
 * - Department managers → active admins
 * - Everyone else → their department manager only (admins are not notified; they can still override)
 * Excludes the requester.
 */
export async function listApproverUserIdsForRequester(
  requesterId: string,
  requesterRole?: Role,
): Promise<string[]> {
  const admin = createAdminClient();

  let role = requesterRole;
  if (!role) {
    const { data } = await admin
      .from("users")
      .select("role")
      .eq("id", requesterId)
      .maybeSingle();
    role = (data?.role as Role | undefined) ?? "employee";
  }

  if (role === "department_manager") {
    return listAdminUserIds(requesterId);
  }

  const ids = new Set<string>();
  const deptId = await getCurrentDepartmentIdForUser(requesterId);
  if (deptId) {
    const managerId = await getDepartmentManagerUserId(deptId);
    if (managerId && managerId !== requesterId) {
      ids.add(managerId);
    }
  }
  return [...ids];
}

/**
 * Resolves notification recipients and rejects employee submissions when no
 * department manager is available to receive the request.
 */
export async function listApproverUserIdsOrThrow(
  requesterId: string,
  requesterRole: Role,
): Promise<string[]> {
  const ids = await listApproverUserIdsForRequester(requesterId, requesterRole);
  if (requesterRole !== "department_manager" && ids.length === 0) {
    throw new ApiError(
      "لا يمكن تقديم الطلب: لا يوجد مدير قسم معيّن لقسمك.",
      409,
      "NO_DEPARTMENT_MANAGER",
    );
  }
  return ids;
}

/** Current member user IDs of a department. */
export async function listDepartmentMemberUserIds(
  departmentId: string,
): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("department_memberships")
    .select("user_id")
    .eq("department_id", departmentId)
    .eq("is_current", true);

  return (data ?? []).map((row) => row.user_id as string);
}

/** All active non-system users (for company announcements). */
export async function listActiveUserIds(
  excludeUserId?: string,
): Promise<string[]> {
  const admin = createAdminClient();
  let q = admin.from("users").select("id").eq("is_active", true);
  if (excludeUserId) {
    q = q.neq("id", excludeUserId);
  }
  const { data } = await q;
  return (data ?? []).map((row) => row.id as string);
}

export async function resolveManagedDepartmentOrNull(
  managerId: string,
): Promise<string | null> {
  return getManagedDepartmentId(managerId);
}
