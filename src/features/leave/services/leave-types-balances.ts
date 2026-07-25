import "server-only";

import type {
  CreateLeaveTypeInput,
  ListLeaveBalancesQuery,
  ListLeaveTypesQuery,
  UpdateLeaveTypeInput,
  UpsertLeaveBalanceInput,
} from "@/features/leave/schemas/leave.schema";
import {
  assertCanViewLeaveUser,
} from "@/features/leave/services/assert-can-approve-leave";
import { calendarYear } from "@/features/leave/services/compute-working-days";
import {
  mapLeaveBalanceRow,
  mapLeaveTypeRow,
  type LeaveBalance,
  type LeaveBalanceRow,
  type LeaveType,
  type LeaveTypeRow,
} from "@/features/leave/types/leave.types";
import {
  getManagedDepartmentId,
} from "@/features/departments/services/membership-helpers";
import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

const TYPE_SELECT = "id, name, description, is_active, created_at, updated_at";
const BALANCE_SELECT =
  "id, user_id, leave_type_id, allocated_days, used_days, year, created_at, updated_at, user:users!user_id(id, full_name, employee_number), leave_type:leave_types!leave_type_id(id, name, is_active)";

export async function listLeaveTypes(
  query: Partial<ListLeaveTypesQuery> = {},
): Promise<LeaveType[]> {
  const admin = createAdminClient();
  let builder = admin.from("leave_types").select(TYPE_SELECT).order("name");

  if (!query.includeInactive) {
    builder = builder.eq("is_active", true);
  }

  const { data, error } = await builder;
  if (error) {
    throw new ApiError("تعذر جلب أنواع الإجازات.", 500, "LIST_LEAVE_TYPES_FAILED");
  }
  return (data as LeaveTypeRow[]).map(mapLeaveTypeRow);
}

export async function createLeaveType(
  input: CreateLeaveTypeInput,
): Promise<LeaveType> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("leave_types")
    .insert({
      name: input.name,
      description: input.description ?? null,
      is_active: true,
    })
    .select(TYPE_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ApiError("اسم نوع الإجازة مستخدم مسبقاً.", 409, "LEAVE_TYPE_EXISTS");
    }
    throw new ApiError("تعذر إنشاء نوع الإجازة.", 500, "CREATE_LEAVE_TYPE_FAILED");
  }
  return mapLeaveTypeRow(data as LeaveTypeRow);
}

export async function updateLeaveType(
  id: string,
  input: UpdateLeaveTypeInput,
): Promise<LeaveType> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { data, error } = await admin
    .from("leave_types")
    .update(patch)
    .eq("id", id)
    .select(TYPE_SELECT)
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      throw new ApiError("اسم نوع الإجازة مستخدم مسبقاً.", 409, "LEAVE_TYPE_EXISTS");
    }
    throw new ApiError("تعذر تحديث نوع الإجازة.", 500, "UPDATE_LEAVE_TYPE_FAILED");
  }
  if (!data) {
    throw new ApiError("نوع الإجازة غير موجود.", 404, "LEAVE_TYPE_NOT_FOUND");
  }
  return mapLeaveTypeRow(data as LeaveTypeRow);
}

/** Soft-deactivate leave type (no physical delete). */
export async function deactivateLeaveType(id: string): Promise<LeaveType> {
  return updateLeaveType(id, { isActive: false });
}

async function pendingDaysByBalanceKeys(
  rows: LeaveBalanceRow[],
): Promise<Map<string, number>> {
  if (rows.length === 0) return new Map();

  const admin = createAdminClient();
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const typeIds = [...new Set(rows.map((r) => r.leave_type_id))];
  const years = [...new Set(rows.map((r) => r.year))];

  const { data, error } = await admin
    .from("leave_requests")
    .select("user_id, leave_type_id, days, start_date, status")
    .in("user_id", userIds)
    .in("leave_type_id", typeIds)
    .eq("status", "pending");

  if (error) {
    throw new ApiError("تعذر حساب أرصدة الإجازات.", 500, "PENDING_LEAVE_SUM_FAILED");
  }

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const year = calendarYear(row.start_date as string);
    if (!years.includes(year)) continue;
    const key = `${row.user_id}:${row.leave_type_id}:${year}`;
    map.set(key, (map.get(key) ?? 0) + Number(row.days));
  }
  return map;
}

export async function listLeaveBalances(
  viewer: AppUser,
  query: ListLeaveBalancesQuery,
): Promise<LeaveBalance[]> {
  if (query.userId) {
    await assertCanViewLeaveUser(viewer, query.userId);
  }

  const admin = createAdminClient();
  let builder = admin.from("leave_balances").select(BALANCE_SELECT);

  if (viewer.role === "employee") {
    builder = builder.eq("user_id", viewer.id);
  } else if (viewer.role === "department_manager") {
    if (query.userId) {
      builder = builder.eq("user_id", query.userId);
    } else {
      const deptId = await getManagedDepartmentId(viewer.id);
      if (!deptId) {
        return [];
      }
      const { data: members, error: memErr } = await admin
        .from("department_memberships")
        .select("user_id")
        .eq("department_id", deptId)
        .eq("is_current", true);
      if (memErr) {
        throw new ApiError("تعذر جلب أرصدة الإجازات.", 500, "LIST_LEAVE_BALANCES_FAILED");
      }
      const ids = (members ?? []).map((m) => m.user_id as string);
      if (ids.length === 0) return [];
      builder = builder.in("user_id", ids);
    }
  } else if (query.userId) {
    builder = builder.eq("user_id", query.userId);
  }

  if (query.year !== undefined) {
    builder = builder.eq("year", query.year);
  }
  if (query.leaveTypeId) {
    builder = builder.eq("leave_type_id", query.leaveTypeId);
  }

  const { data, error } = await builder.order("year", { ascending: false });
  if (error) {
    throw new ApiError("تعذر جلب أرصدة الإجازات.", 500, "LIST_LEAVE_BALANCES_FAILED");
  }

  const rows = (data ?? []) as unknown as LeaveBalanceRow[];
  const pendingMap = await pendingDaysByBalanceKeys(rows);
  return rows.map((row) => {
    const key = `${row.user_id}:${row.leave_type_id}:${row.year}`;
    return mapLeaveBalanceRow(row, pendingMap.get(key) ?? 0);
  });
}

export async function upsertLeaveBalance(
  input: UpsertLeaveBalanceInput,
): Promise<LeaveBalance> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("leave_balances")
    .select("id, used_days")
    .eq("user_id", input.userId)
    .eq("leave_type_id", input.leaveTypeId)
    .eq("year", input.year)
    .maybeSingle();

  if (existing && input.allocatedDays < Number(existing.used_days)) {
    throw new ApiError(
      "لا يمكن أن يكون الرصيد المخصص أقل من الأيام المستخدمة.",
      409,
      "ALLOCATED_BELOW_USED",
    );
  }

  const { data, error } = await admin
    .from("leave_balances")
    .upsert(
      {
        user_id: input.userId,
        leave_type_id: input.leaveTypeId,
        year: input.year,
        allocated_days: input.allocatedDays,
      },
      { onConflict: "user_id,leave_type_id,year" },
    )
    .select(BALANCE_SELECT)
    .single();

  if (error) {
    throw new ApiError("تعذر حفظ رصيد الإجازة.", 500, "UPSERT_LEAVE_BALANCE_FAILED");
  }

  const row = data as unknown as LeaveBalanceRow;
  const pendingMap = await pendingDaysByBalanceKeys([row]);
  const key = `${row.user_id}:${row.leave_type_id}:${row.year}`;
  return mapLeaveBalanceRow(row, pendingMap.get(key) ?? 0);
}
