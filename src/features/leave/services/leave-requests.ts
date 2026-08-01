import "server-only";

import type {
  CreateLeaveRequestInput,
  ListLeaveRequestsQuery,
  RejectLeaveRequestInput,
} from "@/features/leave/schemas/leave.schema";
import {
  assertCanApproveLeave,
  assertCanViewLeaveUser,
} from "@/features/leave/services/assert-can-approve-leave";
import { computeWorkingDays } from "@/features/leave/services/compute-working-days";
import {
  mapLeaveRequestRow,
  type LeaveRequest,
  type LeaveRequestRow,
} from "@/features/leave/types/leave.types";
import {
  getManagedDepartmentId,
} from "@/features/departments/services/membership-helpers";
import { notifySafe } from "@/features/notifications/services/notifications";
import { listApproverUserIdsOrThrow } from "@/features/notifications/services/recipients";
import { listUserIdsByRole } from "@/features/users/services/list-user-ids-by-role";
import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

const LEAVE_REQUEST_SELECT =
  "id, user_id, leave_type_id, start_date, end_date, days, reason, status, approved_by, approved_at, rejection_reason, created_at, updated_at, user:users!user_id(id, full_name, employee_number), leave_type:leave_types!leave_type_id(id, name, is_active), approved_by_user:users!approved_by(id, full_name, employee_number)";

export type LeaveRequestListResult = {
  items: LeaveRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function mapRpcError(message: string | undefined): ApiError {
  const code = (message ?? "").trim() || "LEAVE_RPC_FAILED";
  switch (code) {
    case "INSUFFICIENT_LEAVE_BALANCE":
      return new ApiError(
        "رصيد الإجازة غير كافٍ.",
        409,
        "INSUFFICIENT_LEAVE_BALANCE",
      );
    case "LEAVE_OVERLAP":
      return new ApiError(
        "تتداخل فترة الإجازة مع طلب قائم.",
        409,
        "LEAVE_OVERLAP",
      );
    case "LEAVE_YEAR_MISMATCH":
      return new ApiError(
        "يجب أن تكون بداية ونهاية الإجازة في نفس السنة.",
        400,
        "LEAVE_YEAR_MISMATCH",
      );
    case "LEAVE_TYPE_INACTIVE":
      return new ApiError(
        "نوع الإجازة غير نشط.",
        409,
        "LEAVE_TYPE_INACTIVE",
      );
    case "LEAVE_TYPE_NOT_FOUND":
      return new ApiError("نوع الإجازة غير موجود.", 404, "LEAVE_TYPE_NOT_FOUND");
    case "LEAVE_BALANCE_MISSING":
      return new ApiError(
        "لا يوجد رصيد إجازة لهذا النوع والسنة.",
        409,
        "LEAVE_BALANCE_MISSING",
      );
    case "LEAVE_REQUEST_NOT_FOUND":
      return new ApiError("طلب الإجازة غير موجود.", 404, "LEAVE_REQUEST_NOT_FOUND");
    case "LEAVE_NOT_PENDING":
      return new ApiError(
        "يمكن اعتماد الطلبات المعلقة فقط.",
        409,
        "LEAVE_NOT_PENDING",
      );
    case "INVALID_DATE_RANGE":
      return new ApiError("نطاق التواريخ غير صالح.", 400, "INVALID_DATE_RANGE");
    case "INVALID_LEAVE_DAYS":
    case "ZERO_WORKING_DAYS":
      return new ApiError(
        "لا توجد أيام عمل في الفترة المحددة.",
        400,
        "ZERO_WORKING_DAYS",
      );
    default:
      return new ApiError("تعذر تنفيذ عملية الإجازة.", 500, "LEAVE_RPC_FAILED");
  }
}

async function getLeaveRequestRow(id: string): Promise<LeaveRequestRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("leave_requests")
    .select(LEAVE_REQUEST_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new ApiError("تعذر جلب طلب الإجازة.", 500, "GET_LEAVE_REQUEST_FAILED");
  }
  if (!data) {
    throw new ApiError("طلب الإجازة غير موجود.", 404, "LEAVE_REQUEST_NOT_FOUND");
  }
  return data as unknown as LeaveRequestRow;
}

export async function getLeaveRequestById(
  viewer: AppUser,
  id: string,
): Promise<LeaveRequest> {
  const row = await getLeaveRequestRow(id);
  await assertCanViewLeaveUser(viewer, row.user_id);
  return mapLeaveRequestRow(row);
}

export async function listLeaveRequests(
  viewer: AppUser,
  query: ListLeaveRequestsQuery,
): Promise<LeaveRequestListResult> {
  if (query.userId) {
    await assertCanViewLeaveUser(viewer, query.userId);
  }

  const admin = createAdminClient();
  let builder = admin
    .from("leave_requests")
    .select(LEAVE_REQUEST_SELECT, { count: "exact" });

  if (viewer.role === "employee") {
    builder = builder.eq("user_id", viewer.id);
  } else if (viewer.role === "department_manager") {
    if (query.userId) {
      builder = builder.eq("user_id", query.userId);
    } else {
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
      const { data: members, error: memErr } = await admin
        .from("department_memberships")
        .select("user_id")
        .eq("department_id", deptId)
        .eq("is_current", true);
      if (memErr) {
        throw new ApiError(
          "تعذر جلب طلبات الإجازة.",
          500,
          "LIST_LEAVE_REQUESTS_FAILED",
        );
      }
      const ids = (members ?? []).map((m) => m.user_id as string);
      if (ids.length === 0) {
        return {
          items: [],
          total: 0,
          page: query.page,
          pageSize: query.pageSize,
          totalPages: 0,
        };
      }
      builder = builder.in("user_id", ids);
    }
  } else if (query.userId) {
    builder = builder.eq("user_id", query.userId);
  }

  if (query.requesterRole) {
    const roleIds = await listUserIdsByRole(query.requesterRole);
    if (roleIds.length === 0) {
      return {
        items: [],
        total: 0,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: 0,
      };
    }
    builder = builder.in("user_id", roleIds);
  }

  if (query.status) {
    builder = builder.eq("status", query.status);
  }
  if (query.leaveTypeId) {
    builder = builder.eq("leave_type_id", query.leaveTypeId);
  }

  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  const { data, error, count } = await builder
    .order(query.sortBy, { ascending: query.sortDir === "asc" })
    .range(from, to);

  if (error) {
    throw new ApiError(
      "تعذر جلب طلبات الإجازة.",
      500,
      "LIST_LEAVE_REQUESTS_FAILED",
    );
  }

  const total = count ?? 0;
  return {
    items: ((data ?? []) as unknown as LeaveRequestRow[]).map(mapLeaveRequestRow),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
  };
}

export async function createLeaveRequest(
  actor: AppUser,
  input: CreateLeaveRequestInput,
): Promise<LeaveRequest> {
  const approvers = await listApproverUserIdsOrThrow(actor.id, actor.role);

  let days: number;
  try {
    days = computeWorkingDays(input.startDate, input.endDate);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_DATE_RANGE";
    throw mapRpcError(code);
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("submit_leave_request", {
    p_user_id: actor.id,
    p_leave_type_id: input.leaveTypeId,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_days: days,
    p_reason: input.reason ?? null,
  });

  if (error) {
    throw mapRpcError(error.message);
  }

  const inserted = data as LeaveRequestRow;

  await notifySafe(approvers, {
    type: "approval_request",
    title: "طلب إجازة بانتظار الاعتماد",
    message: `${actor.fullName} · ${input.startDate} → ${input.endDate}`,
    entityType: "leave_request",
    entityId: inserted.id,
  });

  return getLeaveRequestById(actor, inserted.id);
}

export async function approveLeaveRequest(
  actor: AppUser,
  id: string,
): Promise<LeaveRequest> {
  const existing = await getLeaveRequestRow(id);
  await assertCanApproveLeave(actor, existing.user_id);

  if (existing.status !== "pending") {
    throw new ApiError(
      "يمكن اعتماد الطلبات المعلقة فقط.",
      409,
      "LEAVE_NOT_PENDING",
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("approve_leave_request", {
    p_request_id: id,
    p_approver_id: actor.id,
  });

  if (error) {
    throw mapRpcError(error.message);
  }

  await notifySafe(existing.user_id, {
    type: "approval_result",
    title: "تم اعتماد طلب الإجازة",
    message: `${existing.start_date} → ${existing.end_date}`,
    entityType: "leave_request",
    entityId: id,
  });

  return getLeaveRequestById(actor, id);
}

export async function rejectLeaveRequest(
  actor: AppUser,
  id: string,
  input: RejectLeaveRequestInput,
): Promise<LeaveRequest> {
  const existing = await getLeaveRequestRow(id);
  await assertCanApproveLeave(actor, existing.user_id);

  if (existing.status !== "pending") {
    throw new ApiError(
      "يمكن رفض الطلبات المعلقة فقط.",
      409,
      "LEAVE_NOT_PENDING",
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("leave_requests")
    .update({
      status: "rejected",
      approved_by: actor.id,
      approved_at: new Date().toISOString(),
      rejection_reason: input.reason,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select(LEAVE_REQUEST_SELECT)
    .maybeSingle();

  if (error) {
    throw new ApiError("تعذر رفض طلب الإجازة.", 500, "REJECT_LEAVE_FAILED");
  }
  if (!data) {
    throw new ApiError(
      "يمكن رفض الطلبات المعلقة فقط.",
      409,
      "LEAVE_NOT_PENDING",
    );
  }

  await notifySafe(existing.user_id, {
    type: "approval_result",
    title: "تم رفض طلب الإجازة",
    message: input.reason,
    entityType: "leave_request",
    entityId: id,
  });

  return mapLeaveRequestRow(data as unknown as LeaveRequestRow);
}
