import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { assertCanAccessTask } from "@/features/tasks/services/assert-can-access-task";
import type { ListTaskActivityQuery } from "@/features/tasks/schemas/dependency.schema";
import type {
  TaskActivityAction,
  TaskActivityLog,
  TaskUserSummary,
} from "@/features/tasks/types/task.types";
import { createAdminClient } from "@/lib/supabase/admin";

export type TaskActivityListResult = {
  items: TaskActivityLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type ActivityRow = {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user: {
    id: string;
    full_name: string;
    employee_number: string;
  } | null;
};

function mapUser(
  row: ActivityRow["user"],
): TaskUserSummary | null {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    fullName: row.full_name,
    employeeNumber: row.employee_number,
  };
}

export function mapActivityLog(row: ActivityRow): TaskActivityLog {
  return {
    id: row.id,
    userId: row.user_id,
    user: mapUser(row.user),
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export async function logTaskActivity(
  userId: string,
  taskId: string,
  action: TaskActivityAction,
  metadata?: Record<string, unknown> | null,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("activity_logs").insert({
    user_id: userId,
    action,
    entity_type: "task",
    entity_id: taskId,
    metadata: metadata ?? null,
  });

  if (error) {
    console.error("[activity_logs] insert failed:", error.message, error);
    throw new ApiError(
      "تعذر تسجيل نشاط المهمة.",
      500,
      "ACTIVITY_LOG_FAILED",
    );
  }
}

export async function listTaskActivity(
  viewer: AppUser,
  taskId: string,
  query: ListTaskActivityQuery,
): Promise<TaskActivityListResult> {
  await assertCanAccessTask(viewer, taskId);

  const admin = createAdminClient();
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  const { data, error, count } = await admin
    .from("activity_logs")
    .select(
      "id, user_id, action, entity_type, entity_id, metadata, created_at, user:users!user_id(id, full_name, employee_number)",
      { count: "exact" },
    )
    .eq("entity_type", "task")
    .eq("entity_id", taskId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new ApiError(
      "تعذر جلب سجل نشاط المهمة.",
      500,
      "LIST_ACTIVITY_FAILED",
    );
  }

  const total = count ?? 0;
  return {
    items: ((data ?? []) as unknown as ActivityRow[]).map(mapActivityLog),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
