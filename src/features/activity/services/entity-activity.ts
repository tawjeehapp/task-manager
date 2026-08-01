import "server-only";

import { ApiError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ListEntityActivityQuery } from "@/features/activity/schemas/activity.schema";
import type {
  ActivityEntityType,
  ActivityUserSummary,
  EntityActivityListResult,
  EntityActivityLog,
} from "@/features/activity/types/activity.types";

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

function mapUser(row: ActivityRow["user"]): ActivityUserSummary | null {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    employeeNumber: row.employee_number,
  };
}

export function mapEntityActivityLog(row: ActivityRow): EntityActivityLog {
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

export async function logEntityActivity(
  userId: string,
  entityType: ActivityEntityType,
  entityId: string,
  action: string,
  metadata?: Record<string, unknown> | null,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("activity_logs").insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata ?? null,
  });

  if (error) {
    console.error("[activity_logs] insert failed:", error.message, error);
    throw new ApiError(
      "تعذر تسجيل النشاط.",
      500,
      "ACTIVITY_LOG_FAILED",
    );
  }
}

/** Best-effort logging that never fails the parent mutation. */
export async function tryLogEntityActivity(
  userId: string,
  entityType: ActivityEntityType,
  entityId: string,
  action: string,
  metadata?: Record<string, unknown> | null,
): Promise<void> {
  try {
    await logEntityActivity(userId, entityType, entityId, action, metadata);
  } catch (error) {
    console.error("[activity_logs] best-effort log failed:", error);
  }
}

export async function listEntityActivity(
  entityType: ActivityEntityType,
  entityId: string,
  query: ListEntityActivityQuery,
): Promise<EntityActivityListResult> {
  const admin = createAdminClient();
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  const { data, error, count } = await admin
    .from("activity_logs")
    .select(
      "id, user_id, action, entity_type, entity_id, metadata, created_at, user:users!user_id(id, full_name, employee_number)",
      { count: "exact" },
    )
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new ApiError(
      "تعذر جلب سجل النشاط.",
      500,
      "LIST_ACTIVITY_FAILED",
    );
  }

  const total = count ?? 0;
  return {
    items: ((data ?? []) as unknown as ActivityRow[]).map(mapEntityActivityLog),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
