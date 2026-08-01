import "server-only";

import type {
  ApproveEmployeeRequestInput,
  CreateEmployeeRequestInput,
  ListEmployeeRequestsQuery,
  RejectEmployeeRequestInput,
  UpdateEmployeeRequestInput,
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
import { notifySafe } from "@/features/notifications/services/notifications";
import { listApproverUserIdsOrThrow } from "@/features/notifications/services/recipients";
import { assertAssigneeAllowed } from "@/features/tasks/services/assert-can-access-task";
import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

const SELECT =
  "id, user_id, task_id, type, reason, requested_date, status, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at, user:users!user_id(id, full_name, employee_number), reviewed_by_user:users!reviewed_by(id, full_name, employee_number), task:tasks!task_id(id, title, project_id, project:projects!project_id(end_date))";

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
    case "TASK_DUE_AFTER_PROJECT_END":
      return new ApiError(
        "لا يمكن اعتماد التمديد قبل تمديد تاريخ انتهاء المشروع ليغطي الموعد المطلوب.",
        409,
        "TASK_DUE_AFTER_PROJECT_END",
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
  const approvers = await listApproverUserIdsOrThrow(actor.id, actor.role);

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
    await validateExtensionDateForTask(input.taskId, input.requestedDate!);
  }

  const { data, error } = await admin
    .from("employee_requests")
    .insert({
      user_id: actor.id,
      task_id: input.taskId,
      type: input.type,
      reason: input.reason,
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

  const created = mapEmployeeRequestRow(data as unknown as EmployeeRequestRow);
  const typeLabel = input.type === "extension" ? "تمديد مهمة" : "إعفاء من مهمة";
  await notifySafe(approvers, {
    type: "approval_request",
    title: `طلب ${typeLabel} بانتظار الاعتماد`,
    message: actor.fullName,
    entityType: "employee_request",
    entityId: created.id,
  });

  return created;
}

async function validateExtensionDateForTask(
  taskId: string,
  requestedDate: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: task, error: taskError } = await admin
    .from("tasks")
    .select("due_date")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) {
    throw new ApiError("تعذر التحقق من المهمة.", 500, "TASK_LOOKUP_FAILED");
  }
  if (!task) {
    throw new ApiError("المهمة غير موجودة.", 404, "TASK_NOT_FOUND");
  }

  const today = calendarDateInOrgTimezone();
  if (requestedDate < today) {
    throw new ApiError(
      "تاريخ التمديد يجب أن يكون اليوم أو بعده.",
      400,
      "EXTENSION_DATE_INVALID",
    );
  }
  const dueDate = task.due_date as string | null;
  if (dueDate && requestedDate <= dueDate) {
    throw new ApiError(
      "تاريخ التمديد يجب أن يكون بعد الموعد الحالي للمهمة.",
      400,
      "EXTENSION_DATE_INVALID",
    );
  }
}

/** Approvals require the project end date to already cover the requested due date. */
async function assertExtensionFitsProjectEnd(
  taskId: string,
  requestedDate: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: task, error: taskError } = await admin
    .from("tasks")
    .select("project:projects!project_id(end_date)")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) {
    throw new ApiError("تعذر التحقق من المهمة.", 500, "TASK_LOOKUP_FAILED");
  }
  if (!task) {
    throw new ApiError("المهمة غير موجودة.", 404, "TASK_NOT_FOUND");
  }

  const projectRel = task.project as
    | { end_date: string }
    | { end_date: string }[]
    | null;
  const project = Array.isArray(projectRel) ? projectRel[0] : projectRel;
  const projectEnd = project?.end_date as string | undefined;
  if (projectEnd && requestedDate > projectEnd) {
    throw new ApiError(
      "لا يمكن اعتماد التمديد قبل تمديد تاريخ انتهاء المشروع ليغطي الموعد المطلوب.",
      409,
      "TASK_DUE_AFTER_PROJECT_END",
    );
  }
}

export async function updateEmployeeRequest(
  actor: AppUser,
  id: string,
  input: UpdateEmployeeRequestInput,
): Promise<EmployeeRequest> {
  const existing = await getRow(id);

  if (existing.user_id !== actor.id) {
    throw new ApiError(
      "يمكنك تعديل طلباتك فقط.",
      403,
      "NOT_REQUEST_OWNER",
    );
  }
  if (existing.status !== "pending") {
    throw new ApiError(
      "يمكن تعديل الطلبات المعلقة فقط.",
      409,
      "EMPLOYEE_REQUEST_NOT_PENDING",
    );
  }

  const admin = createAdminClient();
  const { data: task, error: taskError } = await admin
    .from("tasks")
    .select("id, assigned_to")
    .eq("id", existing.task_id)
    .maybeSingle();

  if (taskError) {
    throw new ApiError("تعذر التحقق من المهمة.", 500, "TASK_LOOKUP_FAILED");
  }
  if (!task || task.assigned_to !== actor.id) {
    throw new ApiError(
      "يمكنك تعديل الطلب فقط للمهام المسندة إليك.",
      403,
      "NOT_TASK_ASSIGNEE",
    );
  }

  if (existing.type === "excusal" && input.requestedDate !== undefined) {
    throw new ApiError(
      "طلب الإعفاء لا يتضمن تاريخاً.",
      400,
      "VALIDATION_ERROR",
    );
  }

  const patch: {
    reason?: string | null;
    requested_date?: string | null;
  } = {};

  if (input.reason !== undefined) {
    patch.reason = input.reason;
  }

  if (existing.type === "extension" && input.requestedDate !== undefined) {
    if (!input.requestedDate) {
      throw new ApiError(
        "تاريخ التمديد مطلوب",
        400,
        "VALIDATION_ERROR",
      );
    }
    await validateExtensionDateForTask(existing.task_id, input.requestedDate);
    patch.requested_date = input.requestedDate;
  }

  const { data, error } = await admin
    .from("employee_requests")
    .update(patch)
    .eq("id", id)
    .eq("status", "pending")
    .select(SELECT)
    .maybeSingle();

  if (error) {
    throw new ApiError(
      "تعذر تحديث الطلب.",
      500,
      "UPDATE_EMPLOYEE_REQUEST_FAILED",
    );
  }
  if (!data) {
    throw new ApiError(
      "يمكن تعديل الطلبات المعلقة فقط.",
      409,
      "EMPLOYEE_REQUEST_NOT_PENDING",
    );
  }

  return mapEmployeeRequestRow(data as unknown as EmployeeRequestRow);
}

export async function approveEmployeeRequest(
  actor: AppUser,
  id: string,
  input: ApproveEmployeeRequestInput = {},
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

  if (existing.type === "extension" && existing.requested_date) {
    await assertExtensionFitsProjectEnd(
      existing.task_id,
      existing.requested_date,
    );
  }

  let newAssignee: string | null = null;

  if (existing.type === "excusal") {
    newAssignee =
      input.assignedTo === undefined ? null : input.assignedTo;

    if (newAssignee === existing.user_id) {
      throw new ApiError(
        "لا يمكن إعادة إسناد المهمة إلى نفس الموظف المعفى.",
        409,
        "CANNOT_REASSIGN_TO_EXCUSED",
      );
    }

    if (newAssignee) {
      const lookup = createAdminClient();
      const { data: task, error: taskError } = await lookup
        .from("tasks")
        .select("id, project_id")
        .eq("id", existing.task_id)
        .maybeSingle();

      if (taskError || !task) {
        throw new ApiError("المهمة غير موجودة.", 404, "TASK_NOT_FOUND");
      }

      const { data: project, error: projectError } = await lookup
        .from("projects")
        .select("id, department_id")
        .eq("id", task.project_id)
        .maybeSingle();

      if (projectError || !project) {
        throw new ApiError("تعذر التحقق من المشروع.", 500, "PROJECT_LOOKUP_FAILED");
      }

      await assertAssigneeAllowed(
        task.project_id as string,
        project.department_id as string,
        newAssignee,
      );
    }
  } else if (input.assignedTo !== undefined && input.assignedTo !== null) {
    throw new ApiError(
      "إعادة الإسناد متاحة فقط عند اعتماد الإعفاء.",
      400,
      "ASSIGNEE_ONLY_FOR_EXCUSAL",
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("approve_employee_request", {
    p_request_id: id,
    p_reviewer_id: actor.id,
    p_new_assignee: existing.type === "excusal" ? newAssignee : null,
  });

  if (error) {
    throw mapRpcError(error.message);
  }

  const typeLabel =
    existing.type === "extension" ? "تمديد المهمة" : "الإعفاء من المهمة";
  await notifySafe(existing.user_id, {
    type: "approval_result",
    title: `تم اعتماد طلب ${typeLabel}`,
    message: "تمت الموافقة على طلبك",
    entityType: "task",
    entityId: existing.task_id,
  });

  if (existing.type === "excusal" && newAssignee && newAssignee !== actor.id) {
    await notifySafe(newAssignee, {
      type: "task_assigned",
      title: "تم إسناد مهمة إليك",
      message: existing.task?.title ?? "مهمة",
      entityType: "task",
      entityId: existing.task_id,
    });
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

  const typeLabel =
    existing.type === "extension" ? "تمديد المهمة" : "الإعفاء من المهمة";
  await notifySafe(existing.user_id, {
    type: "approval_result",
    title: `تم رفض طلب ${typeLabel}`,
    message: input.reason,
    entityType: "task",
    entityId: existing.task_id,
  });

  return mapEmployeeRequestRow(data as unknown as EmployeeRequestRow);
}
