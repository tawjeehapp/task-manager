import "server-only";

import type {
  CreateProjectRequestInput,
  ListProjectRequestsQuery,
  RejectProjectRequestInput,
} from "@/features/project-requests/schemas/project-request.schema";
import {
  assertCanApproveProjectRequest,
  assertCanViewProjectRequest,
} from "@/features/project-requests/services/assert-can-approve-project-request";
import {
  mapProjectRequestRow,
  type ProjectRequest,
  type ProjectRequestRow,
} from "@/features/project-requests/types/project-request.types";
import { getManagedDepartmentId } from "@/features/departments/services/membership-helpers";
import { calendarDateInOrgTimezone } from "@/features/leave/services/compute-working-days";
import { notifySafe } from "@/features/notifications/services/notifications";
import { listAdminUserIds } from "@/features/notifications/services/recipients";
import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

const SELECT =
  "id, user_id, project_id, type, reason, requested_date, status, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at, user:users!user_id(id, full_name, employee_number), reviewed_by_user:users!reviewed_by(id, full_name, employee_number), project:projects!project_id(id, name, end_date)";

export type ProjectRequestListResult = {
  items: ProjectRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function mapRpcError(message: string | undefined): ApiError {
  const code = (message ?? "").trim() || "PROJECT_REQUEST_RPC_FAILED";
  switch (code) {
    case "PROJECT_REQUEST_NOT_FOUND":
      return new ApiError(
        "الطلب غير موجود.",
        404,
        "PROJECT_REQUEST_NOT_FOUND",
      );
    case "PROJECT_REQUEST_NOT_PENDING":
      return new ApiError(
        "يمكن اعتماد الطلبات المعلقة فقط.",
        409,
        "PROJECT_REQUEST_NOT_PENDING",
      );
    case "PROJECT_NOT_FOUND":
      return new ApiError("المشروع غير موجود.", 404, "PROJECT_NOT_FOUND");
    case "PROJECT_EXTENSION_DATE_INVALID":
      return new ApiError(
        "تاريخ التمديد يجب أن يكون بعد تاريخ انتهاء المشروع الحالي.",
        400,
        "PROJECT_EXTENSION_DATE_INVALID",
      );
    default:
      return new ApiError(
        "تعذر تنفيذ اعتماد الطلب.",
        500,
        "PROJECT_REQUEST_RPC_FAILED",
      );
  }
}

async function getRow(id: string): Promise<ProjectRequestRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("project_requests")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new ApiError(
      "تعذر جلب الطلب.",
      500,
      "GET_PROJECT_REQUEST_FAILED",
    );
  }
  if (!data) {
    throw new ApiError(
      "الطلب غير موجود.",
      404,
      "PROJECT_REQUEST_NOT_FOUND",
    );
  }
  return data as unknown as ProjectRequestRow;
}

export async function getProjectRequestById(
  viewer: AppUser,
  id: string,
): Promise<ProjectRequest> {
  const row = await getRow(id);
  assertCanViewProjectRequest(viewer, row.user_id);
  return mapProjectRequestRow(row);
}

export async function listProjectRequests(
  viewer: AppUser,
  query: ListProjectRequestsQuery,
): Promise<ProjectRequestListResult> {
  const admin = createAdminClient();
  let builder = admin
    .from("project_requests")
    .select(SELECT, { count: "exact" });

  if (viewer.role === "department_manager") {
    builder = builder.eq("user_id", viewer.id);
  } else if (viewer.role !== "admin") {
    return {
      items: [],
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: 0,
    };
  }

  if (query.status) builder = builder.eq("status", query.status);
  if (query.type) builder = builder.eq("type", query.type);
  if (query.projectId) builder = builder.eq("project_id", query.projectId);

  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  const { data, error, count } = await builder
    .order(query.sortBy, { ascending: query.sortDir === "asc" })
    .range(from, to);

  if (error) {
    throw new ApiError(
      "تعذر جلب الطلبات.",
      500,
      "LIST_PROJECT_REQUESTS_FAILED",
    );
  }

  const total = count ?? 0;
  return {
    items: ((data ?? []) as unknown as ProjectRequestRow[]).map(
      mapProjectRequestRow,
    ),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
  };
}

export async function createProjectRequest(
  actor: AppUser,
  input: CreateProjectRequestInput,
): Promise<ProjectRequest> {
  if (actor.role === "admin") {
    throw new ApiError(
      "يمكن للمسؤول تعديل تاريخ انتهاء المشروع مباشرة.",
      400,
      "ADMIN_EDIT_END_DATE_DIRECTLY",
    );
  }

  if (actor.role !== "department_manager") {
    throw new ApiError(
      "طلب تمديد المشروع متاح لمدير القسم فقط.",
      403,
      "FORBIDDEN",
    );
  }

  const managedId = await getManagedDepartmentId(actor.id);
  if (!managedId) {
    throw new ApiError(
      "لم يتم تعيين قسم لك كمدير.",
      403,
      "NO_MANAGED_DEPARTMENT",
    );
  }

  const admin = createAdminClient();
  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id, name, department_id, end_date, status")
    .eq("id", input.projectId)
    .maybeSingle();

  if (projectError) {
    throw new ApiError(
      "تعذر التحقق من المشروع.",
      500,
      "PROJECT_LOOKUP_FAILED",
    );
  }
  if (!project) {
    throw new ApiError("المشروع غير موجود.", 404, "PROJECT_NOT_FOUND");
  }
  if (project.department_id !== managedId) {
    throw new ApiError(
      "يمكنك طلب تمديد مشاريع قسمك فقط.",
      403,
      "FORBIDDEN",
    );
  }
  if (project.status === "archived") {
    throw new ApiError(
      "لا يمكن طلب تمديد لمشروع مؤرشف.",
      409,
      "PROJECT_ARCHIVED",
    );
  }

  const today = calendarDateInOrgTimezone();
  if (input.requestedDate < today) {
    throw new ApiError(
      "تاريخ التمديد يجب أن يكون اليوم أو بعده.",
      400,
      "EXTENSION_DATE_INVALID",
    );
  }
  if (input.requestedDate <= (project.end_date as string)) {
    throw new ApiError(
      "تاريخ التمديد يجب أن يكون بعد تاريخ انتهاء المشروع الحالي.",
      400,
      "PROJECT_EXTENSION_DATE_INVALID",
    );
  }

  const admins = await listAdminUserIds(actor.id);
  if (admins.length === 0) {
    throw new ApiError(
      "لا يمكن تقديم الطلب: لا يوجد مسؤول نشط لاستلامه.",
      409,
      "NO_ADMIN",
    );
  }

  const { data, error } = await admin
    .from("project_requests")
    .insert({
      user_id: actor.id,
      project_id: input.projectId,
      type: "extension",
      reason: input.reason,
      requested_date: input.requestedDate,
      status: "pending",
    })
    .select(SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ApiError(
        "يوجد طلب تمديد معلّق لهذا المشروع.",
        409,
        "PENDING_REQUEST_EXISTS",
      );
    }
    throw new ApiError(
      "تعذر إنشاء الطلب.",
      500,
      "CREATE_PROJECT_REQUEST_FAILED",
    );
  }

  const created = mapProjectRequestRow(data as unknown as ProjectRequestRow);
  await notifySafe(admins, {
    type: "approval_request",
    title: "طلب تمديد تاريخ مشروع بانتظار الاعتماد",
    message: `${actor.fullName} — ${project.name as string}`,
    entityType: "project_request",
    entityId: created.id,
  });

  return created;
}

export async function approveProjectRequest(
  actor: AppUser,
  id: string,
): Promise<ProjectRequest> {
  const existing = await getRow(id);
  assertCanApproveProjectRequest(actor, existing.user_id);

  if (existing.status !== "pending") {
    throw new ApiError(
      "يمكن اعتماد الطلبات المعلقة فقط.",
      409,
      "PROJECT_REQUEST_NOT_PENDING",
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("approve_project_request", {
    p_request_id: id,
    p_reviewer_id: actor.id,
  });

  if (error) {
    throw mapRpcError(error.message);
  }

  await notifySafe(existing.user_id, {
    type: "approval_result",
    title: "تم اعتماد طلب تمديد المشروع",
    message: existing.project?.name ?? "مشروع",
    entityType: "project_request",
    entityId: id,
  });

  return getProjectRequestById(actor, id);
}

export async function rejectProjectRequest(
  actor: AppUser,
  id: string,
  input: RejectProjectRequestInput,
): Promise<ProjectRequest> {
  const existing = await getRow(id);
  assertCanApproveProjectRequest(actor, existing.user_id);

  if (existing.status !== "pending") {
    throw new ApiError(
      "يمكن رفض الطلبات المعلقة فقط.",
      409,
      "PROJECT_REQUEST_NOT_PENDING",
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("project_requests")
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
      "REJECT_PROJECT_REQUEST_FAILED",
    );
  }
  if (!data) {
    throw new ApiError(
      "يمكن رفض الطلبات المعلقة فقط.",
      409,
      "PROJECT_REQUEST_NOT_PENDING",
    );
  }

  await notifySafe(existing.user_id, {
    type: "approval_result",
    title: "تم رفض طلب تمديد المشروع",
    message: input.reason,
    entityType: "project_request",
    entityId: id,
  });

  return mapProjectRequestRow(data as unknown as ProjectRequestRow);
}
