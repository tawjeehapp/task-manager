import "server-only";

import {
  assertCanApproveAttendance,
  assertCanViewAttendanceUser,
} from "@/features/attendance/services/assert-can-approve-attendance";
import {
  calendarDateInOrgTimezone,
  computeTotalHours,
  orgLocalDateTimeIso,
} from "@/features/attendance/services/compute-hours";
import type {
  AttendanceAllocationInput,
  ListAttendanceQuery,
  RejectAttendanceInput,
  ResubmitAttendanceInput,
  SubmitAttendanceInput,
  UpdateAttendanceInput,
} from "@/features/attendance/schemas/attendance.schema";
import {
  mapAttendanceRow,
  type AttendanceAllocationSummary,
  type AttendanceRecord,
  type AttendanceRow,
  type EligibleTaskSnapshot,
} from "@/features/attendance/types/attendance.types";
import {
  getManagedDepartmentId,
} from "@/features/departments/services/membership-helpers";
import { notifySafe } from "@/features/notifications/services/notifications";
import { listApproverUserIdsOrThrow } from "@/features/notifications/services/recipients";
import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

const ATTENDANCE_ELIGIBLE_STATUSES = ["todo", "in_progress"] as const;

const ATTENDANCE_SELECT =
  "id, user_id, date, clock_in, clock_out, break_minutes, total_hours, status, approved_by, approved_at, rejection_reason, eligible_tasks_snapshot, created_at, updated_at, user:users!user_id(id, full_name, employee_number), approved_by_user:users!approved_by(id, full_name, employee_number)";

/** Assigned tasks the employee can allocate attendance hours to (excludes blocked/completed). */
export async function listEligibleTasksForAttendance(
  userId: string,
): Promise<EligibleTaskSnapshot[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tasks")
    .select("id, title, status")
    .eq("assigned_to", userId)
    .in("status", [...ATTENDANCE_ELIGIBLE_STATUSES])
    .order("title", { ascending: true });

  if (error) {
    throw new ApiError(
      "تعذر جلب المهام المتاحة للدوام.",
      500,
      "LIST_ELIGIBLE_TASKS_FAILED",
    );
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    status: row.status as EligibleTaskSnapshot["status"],
  }));
}

async function attachDayAllocations(
  records: AttendanceRecord[],
): Promise<AttendanceRecord[]> {
  if (records.length === 0) {
    return records;
  }

  const admin = createAdminClient();
  const userIds = [...new Set(records.map((r) => r.userId))];
  const dates = [...new Set(records.map((r) => r.date))];

  const { data, error } = await admin
    .from("work_logs")
    .select("user_id, date, hours, task_id, description, task:tasks!task_id(id, title)")
    .in("user_id", userIds)
    .in("date", dates);

  if (error) {
    throw new ApiError(
      "تعذر جلب توزيع ساعات الدوام.",
      500,
      "LIST_ATTENDANCE_ALLOCATIONS_FAILED",
    );
  }

  const byKey = new Map<string, AttendanceAllocationSummary[]>();
  for (const row of data ?? []) {
    const userId = row.user_id as string;
    const date = row.date as string;
    const taskId = (row.task_id as string | null) ?? null;
    const taskRaw = row.task as
      | { id: string; title: string }
      | { id: string; title: string }[]
      | null;
    const taskObj = Array.isArray(taskRaw) ? (taskRaw[0] ?? null) : taskRaw;
    const key = `${userId}:${date}`;
    const list = byKey.get(key) ?? [];
    if (taskId) {
      list.push({
        kind: "task",
        taskId,
        title: taskObj?.title ?? "—",
        hours: Number(row.hours),
        reason: null,
      });
    } else {
      list.push({
        kind: "general",
        taskId: null,
        title: "",
        hours: Number(row.hours),
        reason: (row.description as string | null) ?? null,
      });
    }
    byKey.set(key, list);
  }

  return records.map((record) => ({
    ...record,
    allocations: byKey.get(`${record.userId}:${record.date}`) ?? [],
  }));
}

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
  const [withAllocations] = await attachDayAllocations([mapRow(row)]);
  return withAllocations ?? mapRow(row);
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
  if (!data) {
    return null;
  }
  const [withAllocations] = await attachDayAllocations([mapRow(data)]);
  return withAllocations ?? mapRow(data);
}

async function assertAllocatedTasks(
  viewer: AppUser,
  taskIds: string[],
): Promise<void> {
  if (taskIds.length === 0) {
    return;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tasks")
    .select("id, assigned_to")
    .in("id", taskIds);

  if (error) {
    throw new ApiError(
      "تعذر التحقق من المهام.",
      500,
      "VALIDATE_ALLOCATIONS_FAILED",
    );
  }

  const byId = new Map(
    (data ?? []).map((row) => [
      row.id as string,
      row as {
        id: string;
        assigned_to: string | null;
      },
    ]),
  );

  for (const taskId of taskIds) {
    const task = byId.get(taskId);
    if (!task) {
      throw new ApiError("المهمة غير موجودة.", 404, "TASK_NOT_FOUND");
    }
    if (task.assigned_to !== viewer.id) {
      throw new ApiError(
        "يمكن تخصيص الوقت لمهامك المسندة فقط.",
        403,
        "TASK_NOT_ASSIGNED",
      );
    }
  }
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertAllocationsEqualNet(
  allocations: AttendanceAllocationInput[],
  totalHours: number,
): void {
  const allocatedRounded = roundHours(
    allocations.reduce((sum, row) => sum + row.hours, 0),
  );
  if (allocatedRounded !== totalHours) {
    throw new ApiError(
      "يجب أن يساوي مجموع الساعات الموزعة صافي الدوام.",
      409,
      "ALLOCATION_MUST_EQUAL_NET_HOURS",
    );
  }
}

function taskIdsFromAllocations(
  allocations: AttendanceAllocationInput[],
): string[] {
  return allocations
    .filter(
      (row): row is Extract<AttendanceAllocationInput, { type: "task" }> =>
        row.type === "task",
    )
    .map((row) => row.taskId);
}

function allocationsToWorkLogInserts(
  userId: string,
  date: string,
  allocations: AttendanceAllocationInput[],
) {
  return allocations.map((row) => {
    if (row.type === "task") {
      return {
        user_id: userId,
        task_id: row.taskId,
        date,
        hours: row.hours,
        description: null as string | null,
        approved_by: null,
      };
    }
    return {
      user_id: userId,
      task_id: null as string | null,
      date,
      hours: row.hours,
      description: row.reason,
      approved_by: null,
    };
  });
}

/**
 * Manual full-day attendance submit (replaces punch in/out).
 * Explicit task/general allocations must sum exactly to net hours.
 */
export async function submitAttendance(
  viewer: AppUser,
  input: SubmitAttendanceInput,
): Promise<AttendanceRecord> {
  const approvers = await listApproverUserIdsOrThrow(viewer.id, viewer.role);

  let clockInAt: string;
  let clockOutAt: string;
  try {
    clockInAt = orgLocalDateTimeIso(input.date, input.clockIn);
    clockOutAt = orgLocalDateTimeIso(input.date, input.clockOut);
  } catch {
    throw new ApiError("وقت غير صالح.", 400, "INVALID_TIME");
  }

  const totalHours = recomputeOrThrow(
    clockInAt,
    clockOutAt,
    input.breakMinutes,
  );

  assertAllocationsEqualNet(input.allocations, totalHours);
  await assertAllocatedTasks(viewer, taskIdsFromAllocations(input.allocations));

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("attendance_records")
    .select("id")
    .eq("user_id", viewer.id)
    .eq("date", input.date)
    .maybeSingle();

  if (existingError) {
    throw new ApiError("تعذر التحقق من الحضور.", 500, "SUBMIT_ATTENDANCE_FAILED");
  }
  if (existing) {
    throw new ApiError(
      "يوجد سجل حضور لهذا اليوم بالفعل.",
      409,
      "ATTENDANCE_EXISTS",
    );
  }

  const eligibleTasksSnapshot = await listEligibleTasksForAttendance(viewer.id);

  const { data, error } = await admin
    .from("attendance_records")
    .insert({
      user_id: viewer.id,
      date: input.date,
      clock_in: clockInAt,
      clock_out: clockOutAt,
      break_minutes: input.breakMinutes,
      total_hours: totalHours,
      status: "pending",
      eligible_tasks_snapshot: eligibleTasksSnapshot,
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
    throw new ApiError("تعذر حفظ الدوام.", 500, "SUBMIT_ATTENDANCE_FAILED");
  }

  const record = mapRow(data);

  const { error: workLogError } = await admin.from("work_logs").insert(
    allocationsToWorkLogInserts(viewer.id, input.date, input.allocations),
  );

  if (workLogError) {
    await admin.from("attendance_records").delete().eq("id", record.id);
    throw new ApiError(
      workLogError.message
        ? `تعذر حفظ توزيع ساعات الدوام: ${workLogError.message}`
        : "تعذر حفظ توزيع ساعات الدوام.",
      500,
      "CREATE_WORK_LOGS_FAILED",
    );
  }

  await notifySafe(approvers, {
    type: "approval_request",
    title: "حضور بانتظار الاعتماد",
    message: `${viewer.fullName} · ${record.date}`,
    entityType: "attendance_record",
    entityId: record.id,
  });

  return record;
}

async function replaceDayWorkLogs(
  userId: string,
  date: string,
  allocations: AttendanceAllocationInput[],
): Promise<void> {
  const admin = createAdminClient();
  const { error: deleteError } = await admin
    .from("work_logs")
    .delete()
    .eq("user_id", userId)
    .eq("date", date);

  if (deleteError) {
    throw new ApiError(
      "تعذر تحديث توزيع ساعات الدوام.",
      500,
      "REPLACE_WORK_LOGS_FAILED",
    );
  }

  const { error: insertError } = await admin.from("work_logs").insert(
    allocationsToWorkLogInserts(userId, date, allocations),
  );

  if (insertError) {
    throw new ApiError(
      insertError.message
        ? `تعذر حفظ توزيع ساعات الدوام: ${insertError.message}`
        : "تعذر حفظ توزيع ساعات الدوام.",
      500,
      "CREATE_WORK_LOGS_FAILED",
    );
  }
}

/**
 * Employee edit of own pending/rejected attendance (full submission + allocations).
 * Approved records stay locked.
 */
export async function resubmitAttendance(
  viewer: AppUser,
  id: string,
  input: ResubmitAttendanceInput,
): Promise<AttendanceRecord> {
  const existing = await getAttendanceRow(id);

  if (viewer.id !== existing.user_id) {
    throw new ApiError("ليس لديك صلاحية تعديل هذا السجل.", 403, "FORBIDDEN");
  }

  if (existing.status === "approved") {
    throw new ApiError(
      "لا يمكن تعديل سجل حضور معتمد.",
      409,
      "ATTENDANCE_APPROVED_LOCKED",
    );
  }

  if (existing.status !== "pending" && existing.status !== "rejected") {
    throw new ApiError(
      "لا يمكن تعديل هذا السجل.",
      409,
      "ATTENDANCE_NOT_EDITABLE",
    );
  }

  let clockInAt: string;
  let clockOutAt: string;
  try {
    clockInAt = orgLocalDateTimeIso(existing.date, input.clockIn);
    clockOutAt = orgLocalDateTimeIso(existing.date, input.clockOut);
  } catch {
    throw new ApiError("وقت غير صالح.", 400, "INVALID_TIME");
  }

  const totalHours = recomputeOrThrow(
    clockInAt,
    clockOutAt,
    input.breakMinutes,
  );

  assertAllocationsEqualNet(input.allocations, totalHours);
  await assertAllocatedTasks(
    viewer,
    taskIdsFromAllocations(input.allocations),
  );

  const eligibleTasksSnapshot = await listEligibleTasksForAttendance(viewer.id);

  const wasRejected = existing.status === "rejected";
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("attendance_records")
    .update({
      clock_in: clockInAt,
      clock_out: clockOutAt,
      break_minutes: input.breakMinutes,
      total_hours: totalHours,
      status: "pending",
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      eligible_tasks_snapshot: eligibleTasksSnapshot,
      updated_at: nowIso(),
    })
    .eq("id", id)
    .select(ATTENDANCE_SELECT)
    .single();

  if (error) {
    throw new ApiError("تعذر تحديث سجل الحضور.", 500, "UPDATE_ATTENDANCE_FAILED");
  }

  await replaceDayWorkLogs(viewer.id, existing.date, input.allocations);

  const record = mapRow(data);
  if (wasRejected) {
    const approvers = await listApproverUserIdsOrThrow(viewer.id, viewer.role);
    await notifySafe(approvers, {
      type: "approval_request",
      title: "حضور بانتظار الاعتماد",
      message: `${viewer.fullName} · ${record.date}`,
      entityType: "attendance_record",
      entityId: record.id,
    });
  }

  return record;
}

/**
 * Employee: own pending/rejected only; rejected/pending correction requires clock_out.
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
    if (existing.status !== "rejected" && existing.status !== "pending") {
      throw new ApiError(
        "لا يمكن تعديل هذا السجل.",
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

  const employeeResubmit =
    isOwner &&
    !isAdmin &&
    (existing.status === "rejected" || existing.status === "pending");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("attendance_records")
    .update({
      clock_in: nextClockIn,
      clock_out: nextClockOut,
      break_minutes: nextBreak,
      total_hours: totalHours,
      status: employeeResubmit ? "pending" : existing.status,
      approved_by: employeeResubmit ? null : existing.approved_by,
      approved_at: employeeResubmit ? null : existing.approved_at,
      rejection_reason: employeeResubmit ? null : existing.rejection_reason,
      updated_at: nowIso(),
    })
    .eq("id", id)
    .select(ATTENDANCE_SELECT)
    .single();

  if (error) {
    throw new ApiError("تعذر تحديث سجل الحضور.", 500, "UPDATE_ATTENDANCE_FAILED");
  }

  const record = mapRow(data);
  if (employeeResubmit && existing.status === "rejected") {
    const approvers = await listApproverUserIdsOrThrow(actor.id, actor.role);
    await notifySafe(approvers, {
      type: "approval_request",
      title: "حضور بانتظار الاعتماد",
      message: `${actor.fullName} · ${record.date}`,
      entityType: "attendance_record",
      entityId: record.id,
    });
  }

  return record;
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

  await notifySafe(existing.user_id, {
    type: "approval_result",
    title: "تم اعتماد الحضور",
    message: existing.date,
    entityType: "attendance_record",
    entityId: id,
  });

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

  await notifySafe(existing.user_id, {
    type: "approval_result",
    title: "تم رفض الحضور",
    message: input.reason,
    entityType: "attendance_record",
    entityId: id,
  });

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

  let items = (data ?? []).map((row) => mapRow(row));
  if (query.awaitingApproval || query.includeAllocations) {
    items = await attachDayAllocations(items);
  }
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
