import "server-only";

import {
  assertCanApproveAttendance,
  assertCanViewAttendanceUser,
} from "@/features/attendance/services/assert-can-approve-attendance";
import {
  calendarDateInOrgTimezone,
  computeTotalHours,
} from "@/features/attendance/services/compute-hours";
import type {
  ClockOutInput,
  ListAttendanceQuery,
  RejectAttendanceInput,
  UpdateAttendanceInput,
} from "@/features/attendance/schemas/attendance.schema";
import {
  mapAttendanceRow,
  type AttendanceRecord,
  type AttendanceRow,
} from "@/features/attendance/types/attendance.types";
import {
  getManagedDepartmentId,
} from "@/features/departments/services/membership-helpers";
import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

const ATTENDANCE_SELECT =
  "id, user_id, date, clock_in, clock_out, break_minutes, total_hours, status, approved_by, approved_at, rejection_reason, created_at, updated_at, user:users!user_id(id, full_name, employee_number), approved_by_user:users!approved_by(id, full_name, employee_number)";

function mapRow(data: unknown): AttendanceRecord {
  return mapAttendanceRow(data as AttendanceRow);
}

function nowIso(): string {
  return new Date().toISOString();
}

function recomputeOrThrow(
  clockIn: string,
  clockOut: string,
  breakMinutes: number,
): number {
  try {
    return computeTotalHours(clockIn, clockOut, breakMinutes);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_TIME_RANGE";
    if (code === "BREAK_EXCEEDS_DURATION") {
      throw new ApiError(
        "مدة الاستراحة تتجاوز وقت الحضور.",
        409,
        "BREAK_EXCEEDS_DURATION",
      );
    }
    throw new ApiError(
      "وقت الخروج يجب أن يكون بعد وقت الدخول.",
      409,
      "INVALID_TIME_RANGE",
    );
  }
}

async function getAttendanceRow(id: string): Promise<AttendanceRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("attendance_records")
    .select(ATTENDANCE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new ApiError("تعذر جلب سجل الحضور.", 500, "GET_ATTENDANCE_FAILED");
  }
  if (!data) {
    throw new ApiError("سجل الحضور غير موجود.", 404, "ATTENDANCE_NOT_FOUND");
  }
  return data as unknown as AttendanceRow;
}

export async function getAttendanceById(
  viewer: AppUser,
  id: string,
): Promise<AttendanceRecord> {
  const row = await getAttendanceRow(id);
  await assertCanViewAttendanceUser(viewer, row.user_id);
  return mapRow(row);
}

export async function getTodayAttendance(
  viewer: AppUser,
): Promise<AttendanceRecord | null> {
  const date = calendarDateInOrgTimezone();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("attendance_records")
    .select(ATTENDANCE_SELECT)
    .eq("user_id", viewer.id)
    .eq("date", date)
    .maybeSingle();

  if (error) {
    throw new ApiError("تعذر جلب حضور اليوم.", 500, "GET_ATTENDANCE_FAILED");
  }
  return data ? mapRow(data) : null;
}

export async function clockIn(viewer: AppUser): Promise<AttendanceRecord> {
  const date = calendarDateInOrgTimezone();
  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("attendance_records")
    .select("id, clock_out, status")
    .eq("user_id", viewer.id)
    .eq("date", date)
    .maybeSingle();

  if (existingError) {
    throw new ApiError("تعذر التحقق من الحضور.", 500, "CLOCK_IN_FAILED");
  }

  if (existing) {
    if (existing.clock_out == null) {
      throw new ApiError(
        "أنت مسجّل دخولاً بالفعل لهذا اليوم.",
        409,
        "ALREADY_CLOCKED_IN",
      );
    }
    throw new ApiError(
      "يوجد سجل حضور لهذا اليوم بالفعل.",
      409,
      "ATTENDANCE_EXISTS",
    );
  }

  const clockInAt = nowIso();
  const { data, error } = await admin
    .from("attendance_records")
    .insert({
      user_id: viewer.id,
      date,
      clock_in: clockInAt,
      clock_out: null,
      break_minutes: 0,
      total_hours: null,
      status: "pending",
    })
    .select(ATTENDANCE_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ApiError(
        "يوجد سجل حضور لهذا اليوم بالفعل.",
        409,
        "ATTENDANCE_EXISTS",
      );
    }
    throw new ApiError("تعذر تسجيل الدخول.", 500, "CLOCK_IN_FAILED");
  }

  return mapRow(data);
}

export async function clockOut(
  viewer: AppUser,
  input: ClockOutInput,
): Promise<AttendanceRecord> {
  const date = calendarDateInOrgTimezone();
  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("attendance_records")
    .select("*")
    .eq("user_id", viewer.id)
    .eq("date", date)
    .maybeSingle();

  if (existingError) {
    throw new ApiError("تعذر التحقق من الحضور.", 500, "CLOCK_OUT_FAILED");
  }

  if (!existing || existing.clock_out != null) {
    throw new ApiError(
      "لا يوجد تسجيل دخول مفتوح للخروج.",
      409,
      "NOT_CLOCKED_IN",
    );
  }

  if (existing.status !== "pending") {
    throw new ApiError(
      "لا يمكن تسجيل الخروج لهذا السجل.",
      409,
      "ATTENDANCE_NOT_EDITABLE",
    );
  }

  const clockOutAt = nowIso();
  const breakMinutes = input.breakMinutes ?? existing.break_minutes ?? 0;
  const totalHours = recomputeOrThrow(
    existing.clock_in,
    clockOutAt,
    breakMinutes,
  );

  const { data, error } = await admin
    .from("attendance_records")
    .update({
      clock_out: clockOutAt,
      break_minutes: breakMinutes,
      total_hours: totalHours,
      updated_at: nowIso(),
    })
    .eq("id", existing.id)
    .select(ATTENDANCE_SELECT)
    .single();

  if (error) {
    throw new ApiError("تعذر تسجيل الخروج.", 500, "CLOCK_OUT_FAILED");
  }

  return mapRow(data);
}

/**
 * Employee: own pending/rejected only; rejected correction requires clock_out.
 * Manager: cannot edit timestamps/break.
 * Admin: may correct any including approved.
 */
export async function updateAttendance(
  actor: AppUser,
  id: string,
  input: UpdateAttendanceInput,
): Promise<AttendanceRecord> {
  const existing = await getAttendanceRow(id);

  if (actor.role === "department_manager") {
    throw new ApiError(
      "لا يمكن لمدير القسم تعديل أوقات الحضور.",
      403,
      "MANAGER_CANNOT_EDIT_ATTENDANCE",
    );
  }

  const isOwner = actor.id === existing.user_id;
  const isAdmin = actor.role === "admin";

  if (!isAdmin && !isOwner) {
    throw new ApiError("ليس لديك صلاحية تعديل هذا السجل.", 403, "FORBIDDEN");
  }

  if (isOwner && !isAdmin) {
    if (existing.status === "approved") {
      throw new ApiError(
        "لا يمكن تعديل سجل حضور معتمد.",
        409,
        "ATTENDANCE_APPROVED_LOCKED",
      );
    }
    if (existing.status !== "rejected") {
      throw new ApiError(
        "يمكن تصحيح السجلات المرفوضة فقط.",
        409,
        "ATTENDANCE_NOT_EDITABLE",
      );
    }
    if (
      (input.clockOut === undefined ? existing.clock_out : input.clockOut) ==
      null
    ) {
      throw new ApiError(
        "يجب تحديد وقت الخروج قبل إعادة الإرسال.",
        409,
        "CLOCK_OUT_REQUIRED",
      );
    }
  }

  const nextClockIn = input.clockIn ?? existing.clock_in;
  const nextClockOut =
    input.clockOut === undefined ? existing.clock_out : input.clockOut;
  const nextBreak =
    input.breakMinutes !== undefined
      ? input.breakMinutes
      : existing.break_minutes;

  let totalHours: number | null = existing.total_hours
    ? Number(existing.total_hours)
    : null;

  if (nextClockOut != null) {
    totalHours = recomputeOrThrow(nextClockIn, nextClockOut, nextBreak);
  } else if (isAdmin) {
    totalHours = null;
  }

  const resubmitRejected = isOwner && !isAdmin && existing.status === "rejected";

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("attendance_records")
    .update({
      clock_in: nextClockIn,
      clock_out: nextClockOut,
      break_minutes: nextBreak,
      total_hours: totalHours,
      status: resubmitRejected ? "pending" : existing.status,
      approved_by: resubmitRejected ? null : existing.approved_by,
      approved_at: resubmitRejected ? null : existing.approved_at,
      rejection_reason: resubmitRejected ? null : existing.rejection_reason,
      updated_at: nowIso(),
    })
    .eq("id", id)
    .select(ATTENDANCE_SELECT)
    .single();

  if (error) {
    throw new ApiError("تعذر تحديث سجل الحضور.", 500, "UPDATE_ATTENDANCE_FAILED");
  }

  return mapRow(data);
}

export async function approveAttendance(
  actor: AppUser,
  id: string,
): Promise<AttendanceRecord> {
  const existing = await getAttendanceRow(id);
  await assertCanApproveAttendance(actor, existing.user_id);

  if (existing.clock_out == null) {
    throw new ApiError(
      "لا يمكن اعتماد سجل مفتوح دون وقت خروج.",
      409,
      "CLOCK_OUT_REQUIRED",
    );
  }

  if (existing.status !== "pending") {
    throw new ApiError(
      "يمكن اعتماد السجلات قيد الانتظار فقط.",
      409,
      "ATTENDANCE_NOT_PENDING",
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("attendance_records")
    .update({
      status: "approved",
      approved_by: actor.id,
      approved_at: nowIso(),
      rejection_reason: null,
      updated_at: nowIso(),
    })
    .eq("id", id)
    .select(ATTENDANCE_SELECT)
    .single();

  if (error) {
    throw new ApiError("تعذر اعتماد الحضور.", 500, "APPROVE_ATTENDANCE_FAILED");
  }

  return mapRow(data);
}

export async function rejectAttendance(
  actor: AppUser,
  id: string,
  input: RejectAttendanceInput,
): Promise<AttendanceRecord> {
  const existing = await getAttendanceRow(id);
  await assertCanApproveAttendance(actor, existing.user_id);

  if (existing.clock_out == null) {
    throw new ApiError(
      "لا يمكن رفض سجل مفتوح دون وقت خروج.",
      409,
      "CLOCK_OUT_REQUIRED",
    );
  }

  if (existing.status !== "pending") {
    throw new ApiError(
      "يمكن رفض السجلات قيد الانتظار فقط.",
      409,
      "ATTENDANCE_NOT_PENDING",
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("attendance_records")
    .update({
      status: "rejected",
      approved_by: actor.id,
      approved_at: nowIso(),
      rejection_reason: input.reason,
      updated_at: nowIso(),
    })
    .eq("id", id)
    .select(ATTENDANCE_SELECT)
    .single();

  if (error) {
    throw new ApiError("تعذر رفض الحضور.", 500, "REJECT_ATTENDANCE_FAILED");
  }

  return mapRow(data);
}

export type AttendanceListResult = {
  items: AttendanceRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalHoursSum: number;
};

export async function listAttendanceForViewer(
  viewer: AppUser,
  query: ListAttendanceQuery,
): Promise<AttendanceListResult> {
  const admin = createAdminClient();
  let q = admin
    .from("attendance_records")
    .select(ATTENDANCE_SELECT, { count: "exact" });

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
        totalHoursSum: 0,
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
        totalHoursSum: 0,
      };
    }
    q = q.in("user_id", memberIds);
  }

  if (query.userId) {
    await assertCanViewAttendanceUser(viewer, query.userId);
    q = q.eq("user_id", query.userId);
  }
  if (query.status) {
    q = q.eq("status", query.status);
  }
  if (query.dateFrom) {
    q = q.gte("date", query.dateFrom);
  }
  if (query.dateTo) {
    q = q.lte("date", query.dateTo);
  }
  if (query.awaitingApproval) {
    q = q.eq("status", "pending").not("clock_out", "is", null);
  }

  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  const { data, error, count } = await q
    .order(query.sortBy, { ascending: query.sortDir === "asc" })
    .range(from, to);

  if (error) {
    throw new ApiError("تعذر جلب سجلات الحضور.", 500, "LIST_ATTENDANCE_FAILED");
  }

  const items = (data ?? []).map((row) => mapRow(row));
  const total = count ?? 0;

  // Sum total_hours for current filter (separate query without pagination)
  let sumQuery = admin
    .from("attendance_records")
    .select("total_hours, user_id, status, clock_out, date");

  if (viewer.role === "employee") {
    sumQuery = sumQuery.eq("user_id", viewer.id);
  } else if (viewer.role === "department_manager") {
    const deptId = await getManagedDepartmentId(viewer.id);
    if (deptId) {
      const { data: members } = await admin
        .from("department_memberships")
        .select("user_id")
        .eq("department_id", deptId)
        .eq("is_current", true);
      const memberIds = (members ?? []).map((m) => m.user_id);
      if (memberIds.length > 0) {
        sumQuery = sumQuery.in("user_id", memberIds);
      } else {
        return {
          items,
          total,
          page: query.page,
          pageSize: query.pageSize,
          totalPages: Math.ceil(total / query.pageSize) || 0,
          totalHoursSum: 0,
        };
      }
    }
  }

  if (query.userId) sumQuery = sumQuery.eq("user_id", query.userId);
  if (query.status) sumQuery = sumQuery.eq("status", query.status);
  if (query.dateFrom) sumQuery = sumQuery.gte("date", query.dateFrom);
  if (query.dateTo) sumQuery = sumQuery.lte("date", query.dateTo);
  if (query.awaitingApproval) {
    sumQuery = sumQuery.eq("status", "pending").not("clock_out", "is", null);
  }

  const { data: sumRows } = await sumQuery;
  const totalHoursSum = (sumRows ?? []).reduce((acc, row) => {
    const v = row.total_hours;
    return acc + (v == null ? 0 : Number(v));
  }, 0);

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.ceil(total / query.pageSize) || 0,
    totalHoursSum: Math.round(totalHoursSum * 100) / 100,
  };
}
