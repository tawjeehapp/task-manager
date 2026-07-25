import "server-only";

import { assertCanAccessTask } from "@/features/tasks/services/assert-can-access-task";
import {
  getManagedDepartmentId,
} from "@/features/departments/services/membership-helpers";
import { sharesManagedDepartmentWith } from "@/features/departments/services/membership-helpers";
import type {
  CreateWorkLogInput,
  ListWorkLogsQuery,
  UpdateWorkLogInput,
} from "@/features/work-logs/schemas/work-log.schema";
import {
  mapWorkLogRow,
  type WorkLog,
  type WorkLogRow,
} from "@/features/work-logs/types/work-log.types";
import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

const WORK_LOG_SELECT =
  "id, user_id, task_id, date, hours, description, approved_by, created_at, updated_at, user:users!user_id(id, full_name, employee_number), task:tasks!task_id(id, title, project_id)";

function mapRow(data: unknown): WorkLog {
  return mapWorkLogRow(data as WorkLogRow);
}

function nowIso(): string {
  return new Date().toISOString();
}

async function getWorkLogRow(id: string): Promise<WorkLogRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("work_logs")
    .select(WORK_LOG_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new ApiError("تعذر جلب سجل العمل.", 500, "GET_WORK_LOG_FAILED");
  }
  if (!data) {
    throw new ApiError("سجل العمل غير موجود.", 404, "WORK_LOG_NOT_FOUND");
  }
  return data as unknown as WorkLogRow;
}

async function assertCanViewWorkLogUser(
  viewer: AppUser,
  targetUserId: string,
): Promise<void> {
  if (viewer.role === "admin" || viewer.id === targetUserId) {
    return;
  }
  if (viewer.role === "department_manager") {
    if (await sharesManagedDepartmentWith(viewer.id, targetUserId)) {
      return;
    }
  }
  throw new ApiError("ليس لديك صلاحية لعرض سجل العمل.", 403, "FORBIDDEN");
}

export async function createWorkLog(
  actor: AppUser,
  input: CreateWorkLogInput,
): Promise<WorkLog> {
  await assertCanAccessTask(actor, input.taskId);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("work_logs")
    .insert({
      user_id: actor.id,
      task_id: input.taskId,
      date: input.date,
      hours: input.hours,
      description: input.description ?? null,
      approved_by: null,
    })
    .select(WORK_LOG_SELECT)
    .single();

  if (error) {
    throw new ApiError("تعذر إنشاء سجل العمل.", 500, "CREATE_WORK_LOG_FAILED");
  }

  return mapRow(data);
}

export async function updateWorkLog(
  actor: AppUser,
  id: string,
  input: UpdateWorkLogInput,
): Promise<WorkLog> {
  const existing = await getWorkLogRow(id);

  if (actor.role !== "admin" && actor.id !== existing.user_id) {
    throw new ApiError("يمكن تعديل سجلاتك فقط.", 403, "FORBIDDEN");
  }

  if (input.taskId) {
    await assertCanAccessTask(actor, input.taskId);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("work_logs")
    .update({
      task_id: input.taskId ?? existing.task_id,
      date: input.date ?? existing.date,
      hours: input.hours ?? existing.hours,
      description:
        input.description === undefined
          ? existing.description
          : input.description,
      updated_at: nowIso(),
    })
    .eq("id", id)
    .select(WORK_LOG_SELECT)
    .single();

  if (error) {
    throw new ApiError("تعذر تحديث سجل العمل.", 500, "UPDATE_WORK_LOG_FAILED");
  }

  return mapRow(data);
}

export async function deleteWorkLog(
  actor: AppUser,
  id: string,
): Promise<void> {
  const existing = await getWorkLogRow(id);

  if (actor.role !== "admin" && actor.id !== existing.user_id) {
    throw new ApiError("يمكن حذف سجلاتك فقط.", 403, "FORBIDDEN");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("work_logs").delete().eq("id", id);

  if (error) {
    throw new ApiError("تعذر حذف سجل العمل.", 500, "DELETE_WORK_LOG_FAILED");
  }
}

export async function getWorkLogById(
  viewer: AppUser,
  id: string,
): Promise<WorkLog> {
  const row = await getWorkLogRow(id);
  await assertCanViewWorkLogUser(viewer, row.user_id);
  return mapRow(row);
}

export type WorkLogListResult = {
  items: WorkLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function listWorkLogsForViewer(
  viewer: AppUser,
  query: ListWorkLogsQuery,
): Promise<WorkLogListResult> {
  const admin = createAdminClient();
  let q = admin.from("work_logs").select(WORK_LOG_SELECT, { count: "exact" });

  if (viewer.role === "employee") {
    q = q.eq("user_id", viewer.id);
  } else if (viewer.role === "department_manager") {
    const deptId = await getManagedDepartmentId(viewer.id);
    if (!deptId) {
      return {
        items: [],
        total: 0,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: 0,
      };
    }
    const { data: members } = await admin
      .from("department_memberships")
      .select("user_id")
      .eq("department_id", deptId)
      .eq("is_current", true);
    const memberIds = (members ?? []).map((m) => m.user_id);
    if (memberIds.length === 0) {
      return {
        items: [],
        total: 0,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: 0,
      };
    }
    q = q.in("user_id", memberIds);
  }

  if (query.userId) {
    await assertCanViewWorkLogUser(viewer, query.userId);
    q = q.eq("user_id", query.userId);
  }
  if (query.taskId) {
    q = q.eq("task_id", query.taskId);
  }
  if (query.dateFrom) {
    q = q.gte("date", query.dateFrom);
  }
  if (query.dateTo) {
    q = q.lte("date", query.dateTo);
  }

  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  const { data, error, count } = await q
    .order(query.sortBy, { ascending: query.sortDir === "asc" })
    .range(from, to);

  if (error) {
    throw new ApiError("تعذر جلب سجلات العمل.", 500, "LIST_WORK_LOGS_FAILED");
  }

  const total = count ?? 0;
  return {
    items: (data ?? []).map((row) => mapRow(row)),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.ceil(total / query.pageSize) || 0,
  };
}
