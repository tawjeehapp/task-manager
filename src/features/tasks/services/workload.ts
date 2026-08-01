import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  CAPACITY_LOAD_STATUSES,
  type EmployeeWorkload,
  type TaskStatus,
} from "@/features/tasks/types/task.types";
import {
  computeEmployeeCapacity,
  countApprovedLeaveDaysInRange,
} from "@/features/tasks/services/capacity";
import {
  currentWeekBounds,
  todayInOrgTimezone,
} from "@/lib/org-calendar";
import { createAdminClient } from "@/lib/supabase/admin";

/** Pure workload/capacity calculation from assigned task rows. */
export function computeEmployeeWorkload(
  userId: string,
  tasks: Array<{ status: TaskStatus | string; estimatedHours: number }>,
  options?: {
    weeklyCapacityHours?: number;
    leaveDaysInWeek?: number;
  },
): EmployeeWorkload {
  return computeEmployeeCapacity({
    userId,
    weeklyCapacityHours: options?.weeklyCapacityHours ?? 40,
    leaveDaysInWeek: options?.leaveDaysInWeek ?? 0,
    tasks,
  });
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
  const today = todayInOrgTimezone();
  const { start: weekStart, end: weekEnd } = currentWeekBounds(today);

  const { data: user, error: userError } = await admin
    .from("users")
    .select("id, weekly_capacity_hours")
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

  const rawCapacity = user.weekly_capacity_hours;
  const capacityNum =
    rawCapacity === null || rawCapacity === undefined
      ? 40
      : typeof rawCapacity === "number"
        ? rawCapacity
        : Number(rawCapacity);
  const weeklyCapacityHours =
    Number.isFinite(capacityNum) && capacityNum > 0 ? capacityNum : 40;

  const [tasksRes, leaveRes] = await Promise.all([
    admin
      .from("tasks")
      .select("status, estimated_hours")
      .eq("assigned_to", userId)
      .in("status", [...CAPACITY_LOAD_STATUSES]),
    admin
      .from("leave_requests")
      .select("start_date, end_date")
      .eq("user_id", userId)
      .eq("status", "approved")
      .lte("start_date", weekEnd)
      .gte("end_date", weekStart),
  ]);

  if (tasksRes.error) {
    throw new ApiError(
      "تعذر جلب عبء العمل.",
      500,
      "WORKLOAD_LOOKUP_FAILED",
    );
  }

  if (leaveRes.error) {
    throw new ApiError(
      "تعذر جلب عبء العمل.",
      500,
      "WORKLOAD_LOOKUP_FAILED",
    );
  }

  const tasks = (tasksRes.data ?? []).map((row) => {
    const raw = row.estimated_hours;
    const n =
      raw === null || raw === undefined
        ? 1
        : typeof raw === "number"
          ? raw
          : Number(raw);
    return {
      status: row.status as string,
      estimatedHours: Number.isFinite(n) && n > 0 ? n : 1,
    };
  });

  const leaveDaysInWeek = countApprovedLeaveDaysInRange(
    weekStart,
    weekEnd,
    (leaveRes.data ?? []).map((row) => ({
      startDate: row.start_date as string,
      endDate: row.end_date as string,
    })),
  );

  return computeEmployeeWorkload(userId, tasks, {
    weeklyCapacityHours,
    leaveDaysInWeek,
  });
}
