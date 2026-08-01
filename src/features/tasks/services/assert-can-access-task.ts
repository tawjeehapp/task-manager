import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { getManagedDepartmentId } from "@/features/departments/services/membership-helpers";
import {
  assertCanAccessProject,
  assertCanManageProjectContents,
  isProjectMember,
} from "@/features/projects/services/assert-can-access-project";
import { createAdminClient } from "@/lib/supabase/admin";

export async function assertCanAccessTask(
  viewer: AppUser,
  taskId: string,
): Promise<{
  projectId: string;
  assignedTo: string | null;
  departmentId: string;
}> {
  const admin = createAdminClient();
  const { data: task, error } = await admin
    .from("tasks")
    .select("id, project_id, assigned_to, project:projects!project_id(department_id)")
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    throw new ApiError(
      "تعذر التحقق من صلاحية المهمة.",
      500,
      "ACCESS_CHECK_FAILED",
    );
  }

  if (!task) {
    throw new ApiError("المهمة غير موجودة.", 404, "TASK_NOT_FOUND");
  }

  const project = task.project as unknown as { department_id: string } | null;
  const departmentId = project?.department_id;
  if (!departmentId) {
    throw new ApiError("المهمة غير موجودة.", 404, "TASK_NOT_FOUND");
  }

  if (viewer.role === "admin") {
    return {
      projectId: task.project_id,
      assignedTo: task.assigned_to,
      departmentId,
    };
  }

  const managedId = await getManagedDepartmentId(viewer.id);
  if (managedId === departmentId) {
    return {
      projectId: task.project_id,
      assignedTo: task.assigned_to,
      departmentId,
    };
  }

  // Employees may list project tasks, but full detail (comments, activity)
  // is limited to tasks assigned to them. Attachments use
  // assertCanViewTaskAttachments instead.
  if (viewer.role === "employee") {
    if (task.assigned_to === viewer.id) {
      return {
        projectId: task.project_id,
        assignedTo: task.assigned_to,
        departmentId,
      };
    }
    throw new ApiError("ليس لديك صلاحية لعرض هذه المهمة.", 403, "FORBIDDEN");
  }

  if (await isProjectMember(task.project_id, viewer.id)) {
    return {
      projectId: task.project_id,
      assignedTo: task.assigned_to,
      departmentId,
    };
  }

  if (task.assigned_to === viewer.id) {
    return {
      projectId: task.project_id,
      assignedTo: task.assigned_to,
      departmentId,
    };
  }

  throw new ApiError("ليس لديك صلاحية لعرض هذه المهمة.", 403, "FORBIDDEN");
}

/**
 * List/download attachments: same as full task access, plus project members
 * (so employees can pull deliverables from peer/blocking tasks).
 */
export async function assertCanViewTaskAttachments(
  viewer: AppUser,
  taskId: string,
): Promise<{
  projectId: string;
  assignedTo: string | null;
  departmentId: string;
}> {
  const admin = createAdminClient();
  const { data: task, error } = await admin
    .from("tasks")
    .select("id, project_id, assigned_to, project:projects!project_id(department_id)")
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    throw new ApiError(
      "تعذر التحقق من صلاحية المهمة.",
      500,
      "ACCESS_CHECK_FAILED",
    );
  }

  if (!task) {
    throw new ApiError("المهمة غير موجودة.", 404, "TASK_NOT_FOUND");
  }

  const project = task.project as unknown as { department_id: string } | null;
  const departmentId = project?.department_id;
  if (!departmentId) {
    throw new ApiError("المهمة غير موجودة.", 404, "TASK_NOT_FOUND");
  }

  const access = {
    projectId: task.project_id as string,
    assignedTo: task.assigned_to as string | null,
    departmentId,
  };

  if (viewer.role === "admin") {
    return access;
  }

  const managedId = await getManagedDepartmentId(viewer.id);
  if (managedId === departmentId) {
    return access;
  }

  if (task.assigned_to === viewer.id) {
    return access;
  }

  if (await isProjectMember(task.project_id, viewer.id)) {
    return access;
  }

  throw new ApiError("ليس لديك صلاحية لعرض مرفقات هذه المهمة.", 403, "FORBIDDEN");
}

export async function assertCanCreateTaskInProject(
  viewer: AppUser,
  projectId: string,
): Promise<{ departmentId: string }> {
  return assertCanManageProjectContents(viewer, projectId);
}

export async function assertAssigneeAllowed(
  projectId: string,
  departmentId: string,
  assignedTo: string | null | undefined,
): Promise<void> {
  if (!assignedTo) {
    return;
  }

  const admin = createAdminClient();

  if (await isProjectMember(projectId, assignedTo)) {
    return;
  }

  const { data: membership } = await admin
    .from("department_memberships")
    .select("id")
    .eq("department_id", departmentId)
    .eq("user_id", assignedTo)
    .eq("is_current", true)
    .maybeSingle();

  if (!membership) {
    throw new ApiError(
      "يجب أن يكون المعيّن عضواً في المشروع أو القسم.",
      409,
      "INVALID_ASSIGNEE",
    );
  }
}

export { assertCanAccessProject };
