import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { getManagedDepartmentId } from "@/features/departments/services/membership-helpers";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { assertCanAccessTask } from "@/features/tasks/services/assert-can-access-task";
import { logTaskActivity } from "@/features/tasks/services/activity-logs";
import type { AddTaskDependencyInput } from "@/features/tasks/schemas/dependency.schema";
import type {
  TaskDependency,
  TaskStatus,
} from "@/features/tasks/types/task.types";
import { createAdminClient } from "@/lib/supabase/admin";

const DEPENDENCY_SELECT =
  "id, task_id, depends_on_task_id, created_at, depends_on_task:tasks!depends_on_task_id(id, title, status, project_id)";

type DependencyWithTask = {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  created_at: string;
  depends_on_task: {
    id: string;
    title: string;
    status: TaskStatus;
    project_id: string;
  } | null;
};

export function mapDependency(row: DependencyWithTask): TaskDependency {
  return {
    id: row.id,
    taskId: row.task_id,
    dependsOnTaskId: row.depends_on_task_id,
    dependsOnTask: row.depends_on_task
      ? {
          id: row.depends_on_task.id,
          title: row.depends_on_task.title,
          status: row.depends_on_task.status,
          projectId: row.depends_on_task.project_id,
        }
      : null,
    createdAt: row.created_at,
  };
}

/** @deprecated Hierarchy rules removed; dependencies are same-project only. Kept for test imports. */
export function isDependencyHierarchyAllowed(_params: {
  taskParentTaskId: string | null;
  dependsOnParentTaskId: string | null;
}): boolean {
  return true;
}

export function assertDependencyHierarchyAllowed(_params: {
  taskParentTaskId: string | null;
  dependsOnParentTaskId: string | null;
}): void {
  // No-op: finish-to-start dependencies are validated by same-project only.
}

/** Pure: true when every prerequisite status is completed. */
export function areDependenciesSatisfied(
  prerequisiteStatuses: Array<TaskStatus | string>,
): boolean {
  return prerequisiteStatuses.every((status) => status === "completed");
}

/** @deprecated Prefer incomplete-deps → blocked + locked status. Kept for tests. */
export function statusRequiresCompletedDependencies(
  status: TaskStatus | string,
): boolean {
  return status === "in_progress" || status === "completed";
}

async function loadPrerequisiteStatuses(taskId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("task_dependencies")
    .select("depends_on_task:tasks!depends_on_task_id(status)")
    .eq("task_id", taskId);

  if (error) {
    throw new ApiError(
      "تعذر التحقق من تبعيات المهمة.",
      500,
      "DEPENDENCY_CHECK_FAILED",
    );
  }

  return (data ?? []).map((row) => {
    const dep = row.depends_on_task as unknown as { status: string } | null;
    return dep?.status ?? "todo";
  });
}

export async function taskHasIncompleteDependencies(
  taskId: string,
): Promise<boolean> {
  const statuses = await loadPrerequisiteStatuses(taskId);
  return statuses.length > 0 && !areDependenciesSatisfied(statuses);
}

/**
 * Status is locked while any finish-to-start dependency is incomplete.
 * Those tasks must remain `blocked` until prerequisites are completed.
 */
export async function assertStatusNotLockedByDependencies(
  taskId: string,
): Promise<void> {
  if (await taskHasIncompleteDependencies(taskId)) {
    throw new ApiError(
      "حالة المهمة مقفلة بسبب تبعيات غير مكتملة.",
      409,
      "STATUS_LOCKED_BY_DEPENDENCIES",
    );
  }
}

export async function assertDependenciesAllowStatus(
  taskId: string,
  nextStatus: TaskStatus | string,
): Promise<void> {
  void nextStatus;
  await assertStatusNotLockedByDependencies(taskId);
}

async function forceTaskBlocked(
  taskId: string,
  actorId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("tasks")
    .select("status")
    .eq("id", taskId)
    .maybeSingle();

  if (lookupError || !existing) {
    return;
  }

  if (existing.status === "blocked") {
    return;
  }

  const { error } = await admin
    .from("tasks")
    .update({ status: "blocked", completed_at: null })
    .eq("id", taskId);

  if (error) {
    throw new ApiError(
      "تعذر تحديث حالة المهمة إلى معلّقة.",
      500,
      "UPDATE_TASK_FAILED",
    );
  }

  await logTaskActivity(actorId, taskId, "task.status_changed", {
    from: existing.status,
    to: "blocked",
    reason: "dependencies_incomplete",
  });
}

/** Ensure waiting tasks are stored as blocked (heals legacy/out-of-sync rows). */
export async function ensureBlockedWhenDependenciesIncomplete(
  taskId: string,
  actorId: string,
): Promise<void> {
  if (await taskHasIncompleteDependencies(taskId)) {
    await forceTaskBlocked(taskId, actorId);
  }
}

async function maybeUnblockTask(
  taskId: string,
  actorId: string,
): Promise<void> {
  if (await taskHasIncompleteDependencies(taskId)) {
    return;
  }

  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("tasks")
    .select("status")
    .eq("id", taskId)
    .maybeSingle();

  if (lookupError || !existing || existing.status !== "blocked") {
    return;
  }

  const { error } = await admin
    .from("tasks")
    .update({ status: "todo", completed_at: null })
    .eq("id", taskId);

  if (error) {
    throw new ApiError(
      "تعذر تحديث حالة المهمة.",
      500,
      "UPDATE_TASK_FAILED",
    );
  }

  await logTaskActivity(actorId, taskId, "task.status_changed", {
    from: "blocked",
    to: "todo",
    reason: "dependencies_satisfied",
  });
}

/** After a prerequisite status/dep changes, block or unblock waiting tasks. */
export async function syncDependentsAfterPrerequisiteChange(
  prerequisiteTaskId: string,
  actorId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("task_dependencies")
    .select("task_id")
    .eq("depends_on_task_id", prerequisiteTaskId);

  if (error) {
    throw new ApiError(
      "تعذر مزامنة المهام المعتمدة.",
      500,
      "DEPENDENCY_SYNC_FAILED",
    );
  }

  for (const row of data ?? []) {
    const dependentId = row.task_id as string;
    if (await taskHasIncompleteDependencies(dependentId)) {
      await forceTaskBlocked(dependentId, actorId);
    } else {
      await maybeUnblockTask(dependentId, actorId);
    }
  }
}

async function assertCanManageDependencies(
  viewer: AppUser,
  access: {
    projectId: string;
    departmentId: string;
  },
): Promise<void> {
  const permissions = await getPermissionsForRole(viewer.role);
  const canAssign = hasPermission(
    viewer.role,
    PERMISSIONS.TASK_ASSIGN,
    permissions,
  );
  const canManageProject =
    viewer.role === "admin" ||
    (viewer.role === "department_manager" &&
      (await getManagedDepartmentId(viewer.id)) === access.departmentId);

  if (!canAssign && !canManageProject) {
    throw new ApiError(
      "ليس لديك صلاحية لإدارة تبعيات هذه المهمة.",
      403,
      "FORBIDDEN",
    );
  }
}

export async function wouldCreateDependencyCycle(
  taskId: string,
  dependsOnTaskId: string,
): Promise<boolean> {
  if (taskId === dependsOnTaskId) {
    return true;
  }

  const admin = createAdminClient();
  const visited = new Set<string>();
  const queue = [dependsOnTaskId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === taskId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const { data, error } = await admin
      .from("task_dependencies")
      .select("depends_on_task_id")
      .eq("task_id", current);

    if (error) {
      throw new ApiError(
        "تعذر التحقق من حلقات التبعية.",
        500,
        "DEPENDENCY_CYCLE_CHECK_FAILED",
      );
    }

    for (const row of data ?? []) {
      queue.push(row.depends_on_task_id as string);
    }
  }

  return false;
}

export async function listTaskDependencies(
  viewer: AppUser,
  taskId: string,
): Promise<TaskDependency[]> {
  await assertCanAccessTask(viewer, taskId);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("task_dependencies")
    .select(DEPENDENCY_SELECT)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new ApiError(
      "تعذر جلب تبعيات المهمة.",
      500,
      "LIST_DEPENDENCIES_FAILED",
    );
  }

  return ((data ?? []) as unknown as DependencyWithTask[]).map(mapDependency);
}

export async function addTaskDependency(
  viewer: AppUser,
  taskId: string,
  input: AddTaskDependencyInput,
): Promise<TaskDependency> {
  const access = await assertCanAccessTask(viewer, taskId);
  await assertCanManageDependencies(viewer, access);

  if (input.dependsOnTaskId === taskId) {
    throw new ApiError(
      "لا يمكن أن تعتمد المهمة على نفسها.",
      409,
      "DEPENDENCY_SELF",
    );
  }

  const admin = createAdminClient();

  const { data: task, error: taskError } = await admin
    .from("tasks")
    .select("id, project_id, status")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError || !task) {
    throw new ApiError("المهمة غير موجودة.", 404, "TASK_NOT_FOUND");
  }

  const { data: dependsOn, error: dependsError } = await admin
    .from("tasks")
    .select("id, project_id, status, title")
    .eq("id", input.dependsOnTaskId)
    .maybeSingle();

  if (dependsError || !dependsOn) {
    throw new ApiError(
      "المهمة المعتمد عليها غير موجودة.",
      404,
      "DEPENDENCY_TASK_NOT_FOUND",
    );
  }

  if (dependsOn.project_id !== task.project_id) {
    throw new ApiError(
      "يجب أن تكون التبعية ضمن نفس المشروع.",
      409,
      "DEPENDENCY_PROJECT_MISMATCH",
    );
  }

  if (await wouldCreateDependencyCycle(taskId, input.dependsOnTaskId)) {
    throw new ApiError(
      "هذه التبعية تُنشئ حلقة دائرية.",
      409,
      "DEPENDENCY_CYCLE",
    );
  }

  const { data, error } = await admin
    .from("task_dependencies")
    .insert({
      task_id: taskId,
      depends_on_task_id: input.dependsOnTaskId,
    })
    .select(DEPENDENCY_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ApiError(
        "التبعية موجودة مسبقاً.",
        409,
        "DEPENDENCY_ALREADY_EXISTS",
      );
    }
    throw new ApiError(
      "تعذر إضافة التبعية.",
      500,
      "ADD_DEPENDENCY_FAILED",
    );
  }

  const mapped = mapDependency(data as unknown as DependencyWithTask);

  await logTaskActivity(viewer.id, taskId, "task.dependency_added", {
    dependsOnTaskId: input.dependsOnTaskId,
    dependsOnTitle: dependsOn.title,
  });

  if (dependsOn.status !== "completed") {
    await forceTaskBlocked(taskId, viewer.id);
  }

  return mapped;
}

export async function removeTaskDependency(
  viewer: AppUser,
  taskId: string,
  dependencyId: string,
): Promise<void> {
  const access = await assertCanAccessTask(viewer, taskId);
  await assertCanManageDependencies(viewer, access);

  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("task_dependencies")
    .select("id, task_id, depends_on_task_id")
    .eq("id", dependencyId)
    .maybeSingle();

  if (lookupError) {
    throw new ApiError(
      "تعذر حذف التبعية.",
      500,
      "REMOVE_DEPENDENCY_FAILED",
    );
  }

  if (!existing || existing.task_id !== taskId) {
    throw new ApiError("التبعية غير موجودة.", 404, "DEPENDENCY_NOT_FOUND");
  }

  const { error } = await admin
    .from("task_dependencies")
    .delete()
    .eq("id", dependencyId);

  if (error) {
    throw new ApiError(
      "تعذر حذف التبعية.",
      500,
      "REMOVE_DEPENDENCY_FAILED",
    );
  }

  await logTaskActivity(viewer.id, taskId, "task.dependency_removed", {
    dependsOnTaskId: existing.depends_on_task_id,
  });

  await maybeUnblockTask(taskId, viewer.id);
}
