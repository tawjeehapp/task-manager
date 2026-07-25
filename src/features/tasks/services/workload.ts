import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  ACTIVE_TASK_STATUSES,
  type EmployeeWorkload,
  type TaskStatus,
} from "@/features/tasks/types/task.types";
import { createAdminClient } from "@/lib/supabase/admin";

/** Pure workload calculation from assigned task rows. */
export function computeEmployeeWorkload(
  userId: string,
  tasks: Array<{ status: TaskStatus | string; estimatedHours: number | null }>,
): EmployeeWorkload {
  let activeTaskCount = 0;
  let estimatedHours = 0;

  for (const task of tasks) {
    if (!ACTIVE_TASK_STATUSES.includes(task.status as TaskStatus)) {
      continue;
    }
    activeTaskCount += 1;
    estimatedHours += task.estimatedHours ?? 0;
  }

  return {
    userId,
    activeTaskCount,
    estimatedHours,
  };
}

export async function getEmployeeWorkload(
  viewer: AppUser,
  userId: string,
): Promise<EmployeeWorkload> {
  const permissions = await getPermissionsForRole(viewer.role);
  const canAssign = hasPermission(
    viewer.role,
    PERMISSIONS.TASK_ASSIGN,
    permissions,
  );

  if (!canAssign && viewer.role !== "admin") {
    throw new ApiError(
      "ليس لديك صلاحية لعرض عبء العمل.",
      403,
      "FORBIDDEN",
    );
  }

  const admin = createAdminClient();

  const { data: user, error: userError } = await admin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (userError) {
    throw new ApiError(
      "تعذر جلب عبء العمل.",
      500,
      "WORKLOAD_LOOKUP_FAILED",
    );
  }

  if (!user) {
    throw new ApiError("المستخدم غير موجود.", 404, "USER_NOT_FOUND");
  }

  const { data, error } = await admin
    .from("tasks")
    .select("status, estimated_hours")
    .eq("assigned_to", userId)
    .in("status", [...ACTIVE_TASK_STATUSES]);

  if (error) {
    throw new ApiError(
      "تعذر جلب عبء العمل.",
      500,
      "WORKLOAD_LOOKUP_FAILED",
    );
  }

  const tasks = (data ?? []).map((row) => ({
    status: row.status as string,
    estimatedHours:
      row.estimated_hours === null || row.estimated_hours === undefined
        ? null
        : typeof row.estimated_hours === "number"
          ? row.estimated_hours
          : Number(row.estimated_hours),
  }));

  return computeEmployeeWorkload(userId, tasks);
}
