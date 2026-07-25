import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { getManagedDepartmentId } from "@/features/departments/services/membership-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function isProjectMember(
  projectId: string,
  userId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Viewer may access a project if admin, manages its department, or is a member.
 */
export async function assertCanAccessProject(
  viewer: AppUser,
  projectId: string,
): Promise<{ departmentId: string }> {
  const admin = createAdminClient();
  const { data: project, error } = await admin
    .from("projects")
    .select("id, department_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new ApiError(
      "تعذر التحقق من صلاحية المشروع.",
      500,
      "ACCESS_CHECK_FAILED",
    );
  }

  if (!project) {
    throw new ApiError("المشروع غير موجود.", 404, "PROJECT_NOT_FOUND");
  }

  if (viewer.role === "admin") {
    return { departmentId: project.department_id };
  }

  const managedId = await getManagedDepartmentId(viewer.id);
  if (managedId === project.department_id) {
    return { departmentId: project.department_id };
  }

  if (await isProjectMember(projectId, viewer.id)) {
    return { departmentId: project.department_id };
  }

  throw new ApiError("ليس لديك صلاحية لعرض هذا المشروع.", 403, "FORBIDDEN");
}

/**
 * Only admins may create/update/archive the project entity itself.
 */
export async function assertCanManageProject(
  viewer: AppUser,
  projectId: string,
): Promise<{ departmentId: string }> {
  const admin = createAdminClient();
  const { data: project, error } = await admin
    .from("projects")
    .select("id, department_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new ApiError(
      "تعذر التحقق من صلاحية المشروع.",
      500,
      "ACCESS_CHECK_FAILED",
    );
  }

  if (!project) {
    throw new ApiError("المشروع غير موجود.", 404, "PROJECT_NOT_FOUND");
  }

  if (viewer.role === "admin") {
    return { departmentId: project.department_id };
  }

  throw new ApiError(
    "إدارة بيانات المشروع متاحة للمسؤول فقط.",
    403,
    "FORBIDDEN",
  );
}

/**
 * Admin or the department manager of the project's department may manage
 * in-project contents (members, and used as gate for task create scope).
 */
export async function assertCanManageProjectContents(
  viewer: AppUser,
  projectId: string,
): Promise<{ departmentId: string }> {
  const admin = createAdminClient();
  const { data: project, error } = await admin
    .from("projects")
    .select("id, department_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new ApiError(
      "تعذر التحقق من صلاحية المشروع.",
      500,
      "ACCESS_CHECK_FAILED",
    );
  }

  if (!project) {
    throw new ApiError("المشروع غير موجود.", 404, "PROJECT_NOT_FOUND");
  }

  if (viewer.role === "admin") {
    return { departmentId: project.department_id };
  }

  if (viewer.role === "department_manager") {
    const managedId = await getManagedDepartmentId(viewer.id);
    if (managedId === project.department_id) {
      return { departmentId: project.department_id };
    }
  }

  throw new ApiError(
    "ليس لديك صلاحية لإدارة محتويات هذا المشروع.",
    403,
    "FORBIDDEN",
  );
}

/** Only admins may create projects. */
export async function assertCanCreateProject(viewer: AppUser): Promise<void> {
  if (viewer.role === "admin") {
    return;
  }

  throw new ApiError("إنشاء المشاريع متاح للمسؤول فقط.", 403, "FORBIDDEN");
}
