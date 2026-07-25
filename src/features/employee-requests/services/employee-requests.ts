import "server-only";

import type {
  CreateEmployeeRequestInput,
  ListEmployeeRequestsQuery,
  RejectEmployeeRequestInput,
} from "@/features/employee-requests/schemas/employee-request.schema";
import {
  assertCanApproveEmployeeRequest,
  assertCanViewEmployeeRequestUser,
} from "@/features/employee-requests/services/assert-can-approve-employee-request";
import {
  mapEmployeeRequestRow,
  type EmployeeRequest,
  type EmployeeRequestRow,
} from "@/features/employee-requests/types/employee-request.types";
import { calendarDateInOrgTimezone } from "@/features/leave/services/compute-working-days";
import {
  getManagedDepartmentId,
} from "@/features/departments/services/membership-helpers";
import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

const SELECT =
  "id, user_id, task_id, type, reason, requested_date, status, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at, user:users!user_id(id, full_name, employee_number), reviewed_by_user:users!reviewed_by(id, full_name, employee_number), task:tasks!task_id(id, title)";

export type EmployeeRequestListResult = {
  items: EmployeeRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function mapRpcError(message: string | undefined): ApiError {
  const code = (message ?? "").trim() || "EMPLOYEE_REQUEST_RPC_FAILED";
  switch (code) {
    case "EMPLOYEE_REQUEST_NOT_FOUND":
      return new ApiError(
        "الطلب غير موجود.",
        404,
        "EMPLOYEE_REQUEST_NOT_FOUND",
      );
    case "EMPLOYEE_REQUEST_NOT_PENDING":
      return new ApiError(
        "يمكن اعتماد الطلبات المعلقة فقط.",
        409,
        "EMPLOYEE_REQUEST_NOT_PENDING",
      );
    case "TASK_NOT_FOUND":
      return new ApiError("المهمة غير موجودة.", 404, "TASK_NOT_FOUND");
    case "EXTENSION_DATE_REQUIRED":
      return new ApiError(
        "تاريخ التمديد مطلوب.",
        400,
        "EXTENSION_DATE_REQUIRED",
      );
    default:
      return new ApiError(
        "تعذر تنفيذ اعتماد الطلب.",
        500,
        "EMPLOYEE_REQUEST_RPC_FAILED",
      );
  }
}

async function getRow(id: string): Promise<EmployeeRequestRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("employee_requests")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new ApiError(
      "تعذر جلب الطلب.",
      500,
      "GET_EMPLOYEE_REQUEST_FAILED",
    );
  }
  if (!data) {
    throw new ApiError(
      "الطلب غير موجود.",
      404,
      "EMPLOYEE_REQUEST_NOT_FOUND",
    );
  }
  return data as unknown as EmployeeRequestRow;
}

export async function getEmployeeRequestById(
  viewer: AppUser,
  id: string,
): Promise<EmployeeRequest> {
  const row = await getRow(id);
  await assertCanViewEmployeeRequestUser(viewer, row.user_id);
  return mapEmployeeRequestRow(row);
}

export async function listEmployeeRequests(
  viewer: AppUser,
  query: ListEmployeeRequestsQuery,
): Promise<EmployeeRequestListResult> {
  if (query.userId) {
    await assertCanViewEmployeeRequestUser(viewer, query.userId);
  }

  const admin = createAdminClient();
  let builder = admin
    .from("employee_requests")
    .select(SELECT, { count: "exact" });

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
          "تعذر جلب الطلبات.",
          500,
          "LIST_EMPLOYEE_REQUESTS_FAILED",
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

  if (query.status) builder = builder.eq("status", query.status);
  if (query.type) builder = builder.eq("type", query.type);
  if (query.taskId) builder = builder.eq("task_id", query.taskId);

  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  const { data, error, count } = await builder
    .order(query.sortBy, { ascending: query.sortDir === "asc" })
    .range(from, to);

  if (error) {
    throw new ApiError(
      "تعذر جلب الطلبات.",
      500,
      "LIST_EMPLOYEE_REQUESTS_FAILED",
    );
  }

  const total = count ?? 0;
  return {
    items: ((data ?? []) as unknown as EmployeeRequestRow[]).map(
      mapEmployeeRequestRow,
    ),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
  };
}

export async function createEmployeeRequest(
  actor: AppUser,
  input: CreateEmployeeRequestInput,
): Promise<EmployeeRequest> {
  const admin = createAdminClient();
  const { data: task, error: taskError } = await admin
    .from("tasks")
    .select("id, assigned_to, due_date")
    .eq("id", input.taskId)
    .maybeSingle();

  if (taskError) {
    throw new ApiError("تعذر التحقق من المهمة.", 500, "TASK_LOOKUP_FAILED");
  }
  if (!task) {
    throw new ApiError("المهمة غير موجودة.", 404, "TASK_NOT_FOUND");
  }
  if (task.assigned_to !== actor.id) {
    throw new ApiError(
      "يمكنك تقديم الطلب فقط للمهام المسندة إليك.",
      403,
      "NOT_TASK_ASSIGNEE",
    );
  }

  if (input.type === "extension") {
    const requested = input.requestedDate!;
    const today = calendarDateInOrgTimezone();
    if (requested < today) {
      throw new ApiError(
        "تاريخ التمديد يجب أن يكون اليوم أو بعده.",
        400,
        "EXTENSION_DATE_INVALID",
      );
    }
    if (task.due_date && requested <= task.due_date) {
      throw new ApiError(
        "تاريخ التمديد يجب أن يكون بعد الموعد الحالي للمهمة.",
        400,
        "EXTENSION_DATE_INVALID",
      );
    }
  }

  const { data, error } = await admin
    .from("employee_requests")
    .insert({
      user_id: actor.id,
      task_id: input.taskId,
      type: input.type,
      reason: input.reason ?? null,
      requested_date: input.type === "extension" ? input.requestedDate : null,
      status: "pending",
    })
    .select(SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ApiError(
        "يوجد طلب معلق من نفس النوع لهذه المهمة.",
        409,
        "PENDING_REQUEST_EXISTS",
      );
    }
    throw new ApiError(
      "تعذر إنشاء الطلب.",
      500,
      "CREATE_EMPLOYEE_REQUEST_FAILED",
    );
  }

  return mapEmployeeRequestRow(data as unknown as EmployeeRequestRow);
}

export async function approveEmployeeRequest(
  actor: AppUser,
  id: string,
): Promise<EmployeeRequest> {
  const existing = await getRow(id);
  await assertCanApproveEmployeeRequest(actor, existing.user_id);

  if (existing.status !== "pending") {
    throw new ApiError(
      "يمكن اعتماد الطلبات المعلقة فقط.",
      409,
      "EMPLOYEE_REQUEST_NOT_PENDING",
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("approve_employee_request", {
    p_request_id: id,
    p_reviewer_id: actor.id,
  });

  if (error) {
    throw mapRpcError(error.message);
  }

  return getEmployeeRequestById(actor, id);
}

export async function rejectEmployeeRequest(
  actor: AppUser,
  id: string,
  input: RejectEmployeeRequestInput,
): Promise<EmployeeRequest> {
  const existing = await getRow(id);
  await assertCanApproveEmployeeRequest(actor, existing.user_id);

  if (existing.status !== "pending") {
    throw new ApiError(
      "يمكن رفض الطلبات المعلقة فقط.",
      409,
      "EMPLOYEE_REQUEST_NOT_PENDING",
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("employee_requests")
    .update({
      status: "rejected",
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: input.reason,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select(SELECT)
    .maybeSingle();

  if (error) {
    throw new ApiError(
      "تعذر رفض الطلب.",
      500,
      "REJECT_EMPLOYEE_REQUEST_FAILED",
    );
  }
  if (!data) {
    throw new ApiError(
      "يمكن رفض الطلبات المعلقة فقط.",
      409,
      "EMPLOYEE_REQUEST_NOT_PENDING",
    );
  }

  return mapEmployeeRequestRow(data as unknown as EmployeeRequestRow);
}
