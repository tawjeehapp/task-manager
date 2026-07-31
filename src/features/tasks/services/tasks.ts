import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { getManagedDepartmentId, getProjectIdsForUser } from "@/features/departments/services/membership-helpers";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  assertAssigneeAllowed,
  assertCanAccessTask,
  assertCanCreateTaskInProject,
} from "@/features/tasks/services/assert-can-access-task";
import { assertCanAccessProject } from "@/features/projects/services/assert-can-access-project";
import {
  addTaskDependency,
  assertStatusNotLockedByDependencies,
  assertDependencyHierarchyAllowed,
  areDependenciesSatisfied,
  ensureBlockedWhenDependenciesIncomplete,
  syncDependentsAfterPrerequisiteChange,
  taskHasIncompleteDependencies,
} from "@/features/tasks/services/dependencies";
import { logTaskActivity } from "@/features/tasks/services/activity-logs";
import { notifySafe } from "@/features/notifications/services/notifications";
import type {
  CreateTaskInput,
  ListTasksQuery,
  UpdateTaskInput,
} from "@/features/tasks/schemas/task.schema";
import type {
  Task,
  TaskProjectSummary,
  TaskRow,
  TaskUserSummary,
} from "@/features/tasks/types/task.types";
import { createAdminClient } from "@/lib/supabase/admin";

export type TasksListResult = {
  items: Task[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type TaskWithRelations = TaskRow & {
  project: {
    id: string;
    name: string;
    department_id: string;
  } | null;
  assignee: {
    id: string;
    full_name: string;
    employee_number: string;
  } | null;
  created_by_user: {
    id: string;
    full_name: string;
    employee_number: string;
  } | null;
};

const TASK_SELECT =
  "id, project_id, parent_task_id, title, description, status, priority, assigned_to, created_by, start_date, due_date, estimated_hours, progress_percentage, completed_at, created_at, updated_at, project:projects!project_id(id, name, department_id), assignee:users!assigned_to(id, full_name, employee_number), created_by_user:users!created_by(id, full_name, employee_number)";

const SORT_COLUMN_MAP: Record<ListTasksQuery["sortBy"], string> = {
  title: "title",
  status: "status",
  priority: "priority",
  dueDate: "due_date",
  startDate: "start_date",
  createdAt: "created_at",
};

function mapUserSummary(
  row:
    | TaskWithRelations["assignee"]
    | TaskWithRelations["created_by_user"],
): TaskUserSummary | null {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    fullName: row.full_name,
    employeeNumber: row.employee_number,
  };
}

function mapProject(
  row: TaskWithRelations["project"],
): TaskProjectSummary | null {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    departmentId: row.department_id,
  };
}

function toHours(value: number | string | null): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === "number" ? value : Number(value);
}

export function mapTask(
  row: TaskWithRelations,
  extras?: {
    subtaskCount?: number;
    dependencyCount?: number;
    incompleteDependencyCount?: number;
  },
): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    project: mapProject(row.project),
    parentTaskId: row.parent_task_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to,
    assignee: mapUserSummary(row.assignee),
    createdBy: row.created_by,
    createdByUser: mapUserSummary(row.created_by_user),
    startDate: row.start_date
      ? String(row.start_date).slice(0, 10)
      : null,
    dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
    estimatedHours: toHours(row.estimated_hours),
    progressPercentage: row.progress_percentage,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subtaskCount: extras?.subtaskCount,
    dependencyCount: extras?.dependencyCount,
    incompleteDependencyCount: extras?.incompleteDependencyCount,
  };
}

async function getSubtaskAggregates(
  taskIds: string[],
): Promise<Map<string, { count: number; hours: number }>> {
  const aggregates = new Map<string, { count: number; hours: number }>();
  if (taskIds.length === 0) {
    return aggregates;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tasks")
    .select("parent_task_id, estimated_hours")
    .in("parent_task_id", taskIds);

  if (error) {
    throw new ApiError(
      "تعذر حساب المهام الفرعية.",
      500,
      "SUBTASK_COUNT_FAILED",
    );
  }

  for (const row of data ?? []) {
    const id = row.parent_task_id as string;
    const current = aggregates.get(id) ?? { count: 0, hours: 0 };
    current.count += 1;
    current.hours += toHours(row.estimated_hours as number | string | null) ?? 0;
    aggregates.set(id, current);
  }

  return aggregates;
}

async function getDependencyAggregates(
  taskIds: string[],
): Promise<Map<string, { count: number; incompleteCount: number }>> {
  const aggregates = new Map<string, { count: number; incompleteCount: number }>();
  if (taskIds.length === 0) {
    return aggregates;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("task_dependencies")
    .select("task_id, depends_on_task:tasks!depends_on_task_id(status)")
    .in("task_id", taskIds);

  if (error) {
    throw new ApiError(
      "تعذر حساب تبعيات المهام.",
      500,
      "DEPENDENCY_COUNT_FAILED",
    );
  }

  for (const row of data ?? []) {
    const id = row.task_id as string;
    const dep = row.depends_on_task as unknown as { status: string } | null;
    const current = aggregates.get(id) ?? { count: 0, incompleteCount: 0 };
    current.count += 1;
    if (dep?.status !== "completed") {
      current.incompleteCount += 1;
    }
    aggregates.set(id, current);
  }

  return aggregates;
}

async function syncParentEstimatedHours(
  parentTaskId: string | null,
): Promise<void> {
  if (!parentTaskId) {
    return;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tasks")
    .select("estimated_hours")
    .eq("parent_task_id", parentTaskId);

  if (error) {
    throw new ApiError(
      "تعذر تحديث ساعات المهمة الأب.",
      500,
      "PARENT_HOURS_SYNC_FAILED",
    );
  }

  const sum = (data ?? []).reduce(
    (total, row) =>
      total + (toHours(row.estimated_hours as number | string | null) ?? 0),
    0,
  );

  const { error: updateError } = await admin
    .from("tasks")
    .update({ estimated_hours: sum })
    .eq("id", parentTaskId);

  if (updateError) {
    throw new ApiError(
      "تعذر تحديث ساعات المهمة الأب.",
      500,
      "PARENT_HOURS_SYNC_FAILED",
    );
  }
}

async function assertCanMutateTask(
  viewer: AppUser,
  access: {
    projectId: string;
    assignedTo: string | null;
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
    throw new ApiError("ليس لديك صلاحية لتحديث هذه المهمة.", 403, "FORBIDDEN");
  }
}

async function loadTaskById(id: string): Promise<Task> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new ApiError("تعذر جلب المهمة.", 500, "GET_TASK_FAILED");
  }

  if (!data) {
    throw new ApiError("المهمة غير موجودة.", 404, "TASK_NOT_FOUND");
  }

  const row = data as unknown as TaskWithRelations;
  const depAggregates = await getDependencyAggregates([row.id]);
  const deps = depAggregates.get(row.id);

  if (row.parent_task_id) {
    return mapTask(row, {
      dependencyCount: deps?.count ?? 0,
      incompleteDependencyCount: deps?.incompleteCount ?? 0,
    });
  }

  const aggregates = await getSubtaskAggregates([row.id]);
  const aggregate = aggregates.get(row.id);
  const mapped = mapTask(row, {
    subtaskCount: aggregate?.count ?? 0,
    dependencyCount: deps?.count ?? 0,
    incompleteDependencyCount: deps?.incompleteCount ?? 0,
  });
  return {
    ...mapped,
    estimatedHours: aggregate?.hours ?? 0,
  };
}

export { loadTaskById };

export async function getTaskForViewer(
  viewer: AppUser,
  taskId: string,
): Promise<Task> {
  await assertCanAccessTask(viewer, taskId);
  return loadTaskById(taskId);
}

export async function createTask(
  viewer: AppUser,
  input: CreateTaskInput,
): Promise<Task> {
  const { departmentId } = await assertCanCreateTaskInProject(
    viewer,
    input.projectId,
  );

  const admin = createAdminClient();

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id, status")
    .eq("id", input.projectId)
    .maybeSingle();

  if (projectError || !project) {
    throw new ApiError("المشروع غير موجود.", 404, "PROJECT_NOT_FOUND");
  }

  if (project.status === "archived") {
    throw new ApiError(
      "لا يمكن إنشاء مهام في مشروع مؤرشف.",
      409,
      "PROJECT_ARCHIVED",
    );
  }

  if (input.parentTaskId) {
    const { data: parent, error: parentError } = await admin
      .from("tasks")
      .select("id, project_id, parent_task_id")
      .eq("id", input.parentTaskId)
      .maybeSingle();

    if (parentError || !parent) {
      throw new ApiError("المهمة الأب غير موجودة.", 404, "PARENT_TASK_NOT_FOUND");
    }

    if (parent.project_id !== input.projectId) {
      throw new ApiError(
        "المهمة الأب يجب أن تكون في نفس المشروع.",
        409,
        "PARENT_PROJECT_MISMATCH",
      );
    }

    if (parent.parent_task_id) {
      throw new ApiError(
        "يُسمح بمستوى واحد فقط من المهام الفرعية.",
        409,
        "SUBTASK_DEPTH_EXCEEDED",
      );
    }
  }

  await assertAssigneeAllowed(
    input.projectId,
    departmentId,
    input.assignedTo ?? null,
  );

  const dependsOnTaskIds = [
    ...new Set(input.dependsOnTaskIds ?? []),
  ];

  let createStatus = input.status;
  let completedAt =
    createStatus === "completed" ? new Date().toISOString() : null;

  if (dependsOnTaskIds.length > 0) {
    const { data: depTasks, error: depLookupError } = await admin
      .from("tasks")
      .select("id, project_id, status, parent_task_id")
      .in("id", dependsOnTaskIds);

    if (depLookupError) {
      throw new ApiError(
        "تعذر التحقق من التبعيات.",
        500,
        "DEPENDENCY_CHECK_FAILED",
      );
    }

    if ((depTasks ?? []).length !== dependsOnTaskIds.length) {
      throw new ApiError(
        "المهمة المعتمد عليها غير موجودة.",
        404,
        "DEPENDENCY_TASK_NOT_FOUND",
      );
    }

    for (const dep of depTasks ?? []) {
      if (dep.project_id !== input.projectId) {
        throw new ApiError(
          "يجب أن تكون التبعية ضمن نفس المشروع.",
          409,
          "DEPENDENCY_PROJECT_MISMATCH",
        );
      }

      assertDependencyHierarchyAllowed({
        taskParentTaskId: input.parentTaskId ?? null,
        dependsOnParentTaskId: (dep.parent_task_id as string | null) ?? null,
      });
    }

    const statuses = (depTasks ?? []).map((row) => row.status as string);
    if (!areDependenciesSatisfied(statuses)) {
      createStatus = "blocked";
      completedAt = null;
    }
  }

  const isSubtask = Boolean(input.parentTaskId);
  const estimatedHours = isSubtask ? (input.estimatedHours ?? null) : 0;

  const { data, error } = await admin
    .from("tasks")
    .insert({
      project_id: input.projectId,
      parent_task_id: input.parentTaskId ?? null,
      title: input.title,
      description: input.description,
      status: createStatus,
      priority: input.priority,
      assigned_to: input.assignedTo ?? null,
      created_by: viewer.id,
      start_date: input.startDate,
      due_date: input.dueDate,
      estimated_hours: estimatedHours,
      completed_at: completedAt,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new ApiError("تعذر إنشاء المهمة.", 500, "CREATE_TASK_FAILED");
  }

  const created = data as TaskRow;
  await syncParentEstimatedHours(created.parent_task_id);

  await logTaskActivity(viewer.id, created.id, "task.created", {
    title: created.title,
    status: created.status,
    assignedTo: created.assigned_to,
    projectId: created.project_id,
    parentTaskId: created.parent_task_id,
  });

  if (created.assigned_to) {
    await logTaskActivity(viewer.id, created.id, "task.assigned", {
      from: null,
      to: created.assigned_to,
    });
    if (created.assigned_to !== viewer.id) {
      await notifySafe(created.assigned_to, {
        type: "task_assigned",
        title: "تم تعيين مهمة إليك",
        message: created.title,
        entityType: "task",
        entityId: created.id,
      });
    }
  }

  for (const dependsOnTaskId of dependsOnTaskIds) {
    await addTaskDependency(viewer, created.id, { dependsOnTaskId });
  }

  return loadTaskById(created.id);
}

export async function updateTask(
  viewer: AppUser,
  taskId: string,
  input: UpdateTaskInput,
): Promise<Task> {
  const access = await assertCanAccessTask(viewer, taskId);
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

  const isAssigneeOnly =
    !canAssign &&
    !canManageProject &&
    access.assignedTo === viewer.id;

  if (isAssigneeOnly) {
    const keys = Object.keys(input).filter(
      (key) => input[key as keyof UpdateTaskInput] !== undefined,
    );
    if (keys.length !== 1 || input.status === undefined) {
      throw new ApiError(
        "يمكنك تحديث حالة مهمتك فقط.",
        403,
        "FORBIDDEN",
      );
    }
  } else if (!canAssign && !canManageProject) {
    throw new ApiError("ليس لديك صلاحية لتحديث هذه المهمة.", 403, "FORBIDDEN");
  }

  if (input.assignedTo !== undefined) {
    if (!canAssign && !canManageProject) {
      throw new ApiError("ليس لديك صلاحية لتعيين المهام.", 403, "FORBIDDEN");
    }
    await assertAssigneeAllowed(
      access.projectId,
      access.departmentId,
      input.assignedTo,
    );
  }

  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("tasks")
    .select(
      "parent_task_id, status, assigned_to, title, description, priority, start_date, due_date, estimated_hours, progress_percentage",
    )
    .eq("id", taskId)
    .maybeSingle();

  if (existingError || !existing) {
    throw new ApiError("المهمة غير موجودة.", 404, "TASK_NOT_FOUND");
  }

  await ensureBlockedWhenDependenciesIncomplete(taskId, viewer.id);
  const statusLocked = await taskHasIncompleteDependencies(taskId);

  const patch: Record<string, unknown> = {};

  if (input.title !== undefined) {
    patch.title = input.title;
  }
  if (input.description !== undefined) {
    patch.description = input.description;
  }
  if (input.priority !== undefined) {
    patch.priority = input.priority;
  }
  if (input.assignedTo !== undefined) {
    patch.assigned_to = input.assignedTo;
  }
  if (input.startDate !== undefined) {
    patch.start_date = input.startDate;
  }
  if (input.dueDate !== undefined) {
    patch.due_date = input.dueDate;
  }
  if (input.estimatedHours !== undefined) {
    if (!existing.parent_task_id) {
      throw new ApiError(
        "ساعات المهمة الأب تُحسب تلقائياً من المهام الفرعية.",
        409,
        "HOURS_FROM_SUBTASKS",
      );
    }

    patch.estimated_hours = input.estimatedHours;
  }
  if (input.progressPercentage !== undefined) {
    patch.progress_percentage = input.progressPercentage;
  }
  if (input.status !== undefined) {
    if (statusLocked) {
      if (input.status !== "blocked" && input.status !== existing.status) {
        await assertStatusNotLockedByDependencies(taskId);
      }
      // Keep forced blocked; do not apply other status while locked.
    } else {
      patch.status = input.status;
      if (input.status === "completed") {
        patch.completed_at = new Date().toISOString();
      } else {
        patch.completed_at = null;
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return loadTaskById(taskId);
  }

  const { error } = await admin.from("tasks").update(patch).eq("id", taskId);

  if (error) {
    throw new ApiError("تعذر تحديث المهمة.", 500, "UPDATE_TASK_FAILED");
  }

  if (input.estimatedHours !== undefined) {
    await syncParentEstimatedHours(existing.parent_task_id as string | null);
  }

  if (
    input.assignedTo !== undefined &&
    input.assignedTo !== existing.assigned_to
  ) {
    await logTaskActivity(viewer.id, taskId, "task.assigned", {
      from: existing.assigned_to,
      to: input.assignedTo,
    });
    if (input.assignedTo && input.assignedTo !== viewer.id) {
      await notifySafe(input.assignedTo, {
        type: "task_assigned",
        title: "تم تعيين مهمة إليك",
        message: (existing.title as string) ?? "مهمة",
        entityType: "task",
        entityId: taskId,
      });
    }
  }

  if (
    input.status !== undefined &&
    input.status !== existing.status &&
    !statusLocked &&
    patch.status !== undefined
  ) {
    await logTaskActivity(viewer.id, taskId, "task.status_changed", {
      from: existing.status,
      to: input.status,
    });

    if (input.status === "completed") {
      const { data: taskMeta } = await admin
        .from("tasks")
        .select("title, created_by, assigned_to")
        .eq("id", taskId)
        .maybeSingle();

      const recipients = new Set<string>();
      if (taskMeta?.created_by && taskMeta.created_by !== viewer.id) {
        recipients.add(taskMeta.created_by as string);
      }
      if (
        taskMeta?.assigned_to &&
        taskMeta.assigned_to !== viewer.id &&
        taskMeta.assigned_to !== taskMeta.created_by
      ) {
        // Creator is primary; assignee completing already knows — skip assignee
      }
      if (recipients.size > 0) {
        await notifySafe([...recipients], {
          type: "task_completed",
          title: "اكتملت مهمة",
          message: (taskMeta?.title as string) ?? "مهمة",
          entityType: "task",
          entityId: taskId,
        });
      }
    }

    await syncDependentsAfterPrerequisiteChange(taskId, viewer.id);
  }

  const otherChanged =
    (input.title !== undefined && input.title !== existing.title) ||
    (input.description !== undefined &&
      input.description !== existing.description) ||
    (input.priority !== undefined && input.priority !== existing.priority) ||
    (input.startDate !== undefined &&
      input.startDate !== existing.start_date) ||
    (input.dueDate !== undefined && input.dueDate !== existing.due_date) ||
    (input.estimatedHours !== undefined &&
      input.estimatedHours !==
        (existing.estimated_hours === null ||
        existing.estimated_hours === undefined
          ? null
          : Number(existing.estimated_hours))) ||
    (input.progressPercentage !== undefined &&
      input.progressPercentage !==
        Number(existing.progress_percentage ?? 0));

  if (otherChanged) {
    await logTaskActivity(viewer.id, taskId, "task.updated", {
      fields: Object.keys(patch).filter(
        (key) => key !== "assigned_to" && key !== "status" && key !== "completed_at",
      ),
    });
  }

  return loadTaskById(taskId);
}

export async function deleteTask(
  viewer: AppUser,
  taskId: string,
): Promise<void> {
  const access = await assertCanAccessTask(viewer, taskId);
  await assertCanMutateTask(viewer, access);

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("tasks")
    .select("parent_task_id")
    .eq("id", taskId)
    .maybeSingle();

  if (existingError || !existing) {
    throw new ApiError("المهمة غير موجودة.", 404, "TASK_NOT_FOUND");
  }

  const parentTaskId = existing.parent_task_id as string | null;

  const { error } = await admin.from("tasks").delete().eq("id", taskId);
  if (error) {
    throw new ApiError("تعذر حذف المهمة.", 500, "DELETE_TASK_FAILED");
  }

  await syncParentEstimatedHours(parentTaskId);
}

export async function listTasksForViewer(
  viewer: AppUser,
  query: ListTasksQuery,
): Promise<TasksListResult> {
  const admin = createAdminClient();
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  const sortColumn = SORT_COLUMN_MAP[query.sortBy];

  if (query.projectId) {
    await assertCanAccessProject(viewer, query.projectId);
  }

  const managedDepartmentId =
    viewer.role === "department_manager"
      ? await getManagedDepartmentId(viewer.id)
      : null;

  let departmentProjectIds: string[] | null = null;
  if (query.departmentId) {
    if (viewer.role === "department_manager") {
      if (!managedDepartmentId || managedDepartmentId !== query.departmentId) {
        return emptyResult(query);
      }
    } else if (viewer.role === "employee") {
      // Employees may narrow by department only within already-visible projects.
    } else if (viewer.role !== "admin") {
      return emptyResult(query);
    }

    const { data: deptProjects } = await admin
      .from("projects")
      .select("id")
      .eq("department_id", query.departmentId);
    departmentProjectIds = (deptProjects ?? []).map((p) => p.id as string);
    if (departmentProjectIds.length === 0) {
      return emptyResult(query);
    }
  }

  let builder = admin.from("tasks").select(TASK_SELECT, { count: "exact" });

  if (viewer.role === "employee") {
    // Employees see assigned tasks, and tasks in projects they belong to
    let projectIds = await getProjectIdsForUser(viewer.id);
    if (departmentProjectIds) {
      const allowed = new Set(departmentProjectIds);
      projectIds = projectIds.filter((id) => allowed.has(id));
    }

    if (query.projectId) {
      if (
        departmentProjectIds &&
        !departmentProjectIds.includes(query.projectId)
      ) {
        return emptyResult(query);
      }
      if (!projectIds.includes(query.projectId) && query.assignee !== viewer.id) {
        // Still allow if they have assigned tasks in this project
        builder = builder
          .eq("project_id", query.projectId)
          .eq("assigned_to", viewer.id);
      } else {
        builder = builder.eq("project_id", query.projectId);
      }
    } else if (query.assignee === viewer.id) {
      builder = builder.eq("assigned_to", viewer.id);
      if (departmentProjectIds) {
        builder = builder.in("project_id", departmentProjectIds);
      }
    } else if (projectIds.length > 0) {
      builder = builder.or(
        `assigned_to.eq.${viewer.id},project_id.in.(${projectIds.join(",")})`,
      );
      if (departmentProjectIds) {
        builder = builder.in("project_id", departmentProjectIds);
      }
    } else {
      builder = builder.eq("assigned_to", viewer.id);
      if (departmentProjectIds) {
        builder = builder.in("project_id", departmentProjectIds);
      }
    }
  } else if (viewer.role === "department_manager") {
    if (!managedDepartmentId) {
      return emptyResult(query);
    }

    let projectIds: string[];
    if (
      departmentProjectIds &&
      query.departmentId === managedDepartmentId
    ) {
      projectIds = departmentProjectIds;
    } else {
      const { data: projects } = await admin
        .from("projects")
        .select("id")
        .eq("department_id", managedDepartmentId);
      projectIds = (projects ?? []).map((p) => p.id as string);
      if (departmentProjectIds) {
        const allowed = new Set(departmentProjectIds);
        projectIds = projectIds.filter((id) => allowed.has(id));
      }
    }

    if (projectIds.length === 0) {
      return emptyResult(query);
    }

    if (query.projectId) {
      if (!projectIds.includes(query.projectId)) {
        return emptyResult(query);
      }
      builder = builder.eq("project_id", query.projectId);
    } else {
      builder = builder.in("project_id", projectIds);
    }
  } else if (query.projectId) {
    if (
      departmentProjectIds &&
      !departmentProjectIds.includes(query.projectId)
    ) {
      return emptyResult(query);
    }
    builder = builder.eq("project_id", query.projectId);
  } else if (departmentProjectIds) {
    builder = builder.in("project_id", departmentProjectIds);
  }

  if (query.status) {
    builder = builder.eq("status", query.status);
  }
  if (query.assignee) {
    builder = builder.eq("assigned_to", query.assignee);
  }
  if (query.priority) {
    builder = builder.eq("priority", query.priority);
  }
  if (query.subtasksOnly) {
    builder = builder.not("parent_task_id", "is", null);
  } else if (query.parentTaskId === null) {
    builder = builder.is("parent_task_id", null);
  } else if (query.parentTaskId !== undefined) {
    builder = builder.eq("parent_task_id", query.parentTaskId);
  }
  if (query.dueFrom) {
    builder = builder.gte("due_date", query.dueFrom);
  }
  if (query.dueTo) {
    builder = builder.lte("due_date", query.dueTo);
  }

  builder = builder
    .order(sortColumn, { ascending: query.sortDir === "asc" })
    .range(from, to);

  const { data, error, count } = await builder;

  if (error) {
    throw new ApiError("تعذر جلب المهام.", 500, "LIST_TASKS_FAILED");
  }

  const rows = (data ?? []) as unknown as TaskWithRelations[];
  const rootIds = rows.filter((r) => !r.parent_task_id).map((r) => r.id);
  const allIds = rows.map((r) => r.id);
  const [aggregates, depAggregates] = await Promise.all([
    getSubtaskAggregates(rootIds),
    getDependencyAggregates(allIds),
  ]);
  const total = count ?? 0;

  return {
    items: rows.map((row) => {
      const deps = depAggregates.get(row.id);
      const depExtras = {
        dependencyCount: deps?.count ?? 0,
        incompleteDependencyCount: deps?.incompleteCount ?? 0,
      };

      if (row.parent_task_id) {
        return mapTask(row, depExtras);
      }
      const aggregate = aggregates.get(row.id);
      const mapped = mapTask(row, {
        subtaskCount: aggregate?.count ?? 0,
        ...depExtras,
      });
      return {
        ...mapped,
        estimatedHours: aggregate?.hours ?? 0,
      };
    }),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

function emptyResult(query: ListTasksQuery): TasksListResult {
  return {
    items: [],
    total: 0,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: 1,
  };
}

export async function listSubtasks(
  viewer: AppUser,
  parentTaskId: string,
): Promise<Task[]> {
  await assertCanAccessTask(viewer, parentTaskId);
  const result = await listTasksForViewer(viewer, {
    parentTaskId,
    page: 1,
    pageSize: 100,
    sortBy: "createdAt",
    sortDir: "asc",
  });
  return result.items;
}
