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
  IncompleteDependencySummary,
  Task,
  TaskProjectSummary,
  TaskRow,
  TaskStatus,
  TaskUserSummary,
} from "@/features/tasks/types/task.types";
import type { TaskAttachmentSummary } from "@/features/tasks/types/comment-attachment.types";
import { getAttachmentSummariesByTaskIds } from "@/features/tasks/services/attachments";
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
    end_date: string;
    department:
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
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
  "id, project_id, title, description, status, priority, assigned_to, created_by, start_date, due_date, estimated_hours, completed_at, created_at, updated_at, project:projects!project_id(id, name, department_id, end_date, department:departments!department_id(id, name)), assignee:users!assigned_to(id, full_name, employee_number), created_by_user:users!created_by(id, full_name, employee_number)";

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
  includeEmployeeNumber = true,
): TaskUserSummary | null {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    fullName: row.full_name,
    ...(includeEmployeeNumber
      ? { employeeNumber: row.employee_number }
      : {}),
  };
}

function embedOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapProject(
  row: TaskWithRelations["project"],
  departmentNames?: Map<string, string>,
): TaskProjectSummary | null {
  if (!row) {
    return null;
  }
  const embedded = embedOne(row.department);
  return {
    id: row.id,
    name: row.name,
    departmentId: row.department_id,
    departmentName:
      embedded?.name ?? departmentNames?.get(row.department_id) ?? null,
    endDate: String(row.end_date).slice(0, 10),
  };
}

async function getDepartmentNameMap(
  departmentIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(departmentIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("departments")
    .select("id, name")
    .in("id", unique);
  if (error) {
    throw new ApiError("تعذر جلب الأقسام.", 500, "LIST_DEPARTMENTS_FAILED");
  }
  for (const row of data ?? []) {
    map.set(row.id as string, row.name as string);
  }
  return map;
}

function toHours(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 1;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

type DependencyAggregate = {
  count: number;
  incompleteCount: number;
  incompleteTitles: string[];
  incompleteDependencies: IncompleteDependencySummary[];
};

type DependsOnTaskJoin = {
  id: string;
  status: string;
  title: string;
  due_date: string | null;
  assignee: {
    id: string;
    full_name: string;
    employee_number: string;
  } | null;
};

export function mapTask(
  row: TaskWithRelations,
  extras?: {
    dependencyCount?: number;
    incompleteDependencyCount?: number;
    incompleteDependencyTitles?: string[];
    incompleteDependencies?: IncompleteDependencySummary[];
    attachments?: TaskAttachmentSummary[];
    includeEmployeeNumber?: boolean;
    departmentNames?: Map<string, string>;
  },
): Task {
  const includeEmployeeNumber = extras?.includeEmployeeNumber !== false;
  return {
    id: row.id,
    projectId: row.project_id,
    project: mapProject(row.project, extras?.departmentNames),
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to,
    assignee: mapUserSummary(row.assignee, includeEmployeeNumber),
    createdBy: row.created_by,
    createdByUser: mapUserSummary(row.created_by_user, includeEmployeeNumber),
    startDate: row.start_date
      ? String(row.start_date).slice(0, 10)
      : null,
    dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
    estimatedHours: toHours(row.estimated_hours),
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dependencyCount: extras?.dependencyCount,
    incompleteDependencyCount: extras?.incompleteDependencyCount,
    incompleteDependencyTitles: extras?.incompleteDependencyTitles,
    incompleteDependencies: extras?.incompleteDependencies?.map((dep) =>
      includeEmployeeNumber
        ? dep
        : {
            ...dep,
            assignee: dep.assignee
              ? {
                  id: dep.assignee.id,
                  fullName: dep.assignee.fullName,
                }
              : null,
          },
    ),
    attachments: extras?.attachments,
  };
}

function mapIncompleteDependency(
  dep: DependsOnTaskJoin,
): IncompleteDependencySummary {
  return {
    id: dep.id,
    title: dep.title,
    status: dep.status as TaskStatus,
    dueDate: dep.due_date ? String(dep.due_date).slice(0, 10) : null,
    assignee: mapUserSummary(dep.assignee),
  };
}

async function getDependencyAggregates(
  taskIds: string[],
): Promise<Map<string, DependencyAggregate>> {
  const aggregates = new Map<string, DependencyAggregate>();
  if (taskIds.length === 0) {
    return aggregates;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("task_dependencies")
    .select(
      "task_id, depends_on_task:tasks!depends_on_task_id(id, status, title, due_date, assignee:users!assigned_to(id, full_name, employee_number))",
    )
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
    const dep = row.depends_on_task as unknown as DependsOnTaskJoin | null;
    const current = aggregates.get(id) ?? {
      count: 0,
      incompleteCount: 0,
      incompleteTitles: [],
      incompleteDependencies: [],
    };
    current.count += 1;
    if (dep && dep.status !== "completed") {
      current.incompleteCount += 1;
      current.incompleteDependencies.push(mapIncompleteDependency(dep));
      if (dep.title) {
        current.incompleteTitles.push(dep.title);
      }
    }
    aggregates.set(id, current);
  }

  return aggregates;
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

function assertTaskDueWithinProjectEnd(
  dueDate: string | null | undefined,
  projectEndDate: string,
): void {
  if (dueDate == null || dueDate === "") {
    return;
  }
  if (dueDate > projectEndDate) {
    throw new ApiError(
      "تاريخ استحقاق المهمة لا يمكن أن يتجاوز تاريخ انتهاء المشروع.",
      400,
      "TASK_DUE_AFTER_PROJECT_END",
    );
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
  const departmentNames = await getDepartmentNameMap(
    row.project?.department_id ? [row.project.department_id] : [],
  );

  return mapTask(row, {
    dependencyCount: deps?.count ?? 0,
    incompleteDependencyCount: deps?.incompleteCount ?? 0,
    incompleteDependencyTitles: deps?.incompleteTitles ?? [],
    incompleteDependencies: deps?.incompleteDependencies ?? [],
    departmentNames,
  });
}

export { loadTaskById };

export async function getTaskForViewer(
  viewer: AppUser,
  taskId: string,
): Promise<Task> {
  await assertCanAccessTask(viewer, taskId);
  return loadTaskForViewer(viewer, taskId);
}

function redactTaskEmployeeNumbers(task: Task): Task {
  return {
    ...task,
    assignee: task.assignee
      ? { id: task.assignee.id, fullName: task.assignee.fullName }
      : null,
    createdByUser: task.createdByUser
      ? { id: task.createdByUser.id, fullName: task.createdByUser.fullName }
      : null,
    incompleteDependencies: task.incompleteDependencies?.map((dep) => ({
      ...dep,
      assignee: dep.assignee
        ? { id: dep.assignee.id, fullName: dep.assignee.fullName }
        : null,
    })),
  };
}

async function loadTaskForViewer(
  viewer: AppUser,
  taskId: string,
): Promise<Task> {
  const task = await loadTaskById(taskId);
  return viewer.role === "employee"
    ? redactTaskEmployeeNumbers(task)
    : task;
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
    .select("id, status, end_date")
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

  assertTaskDueWithinProjectEnd(
    input.dueDate ?? null,
    project.end_date as string,
  );

  await assertAssigneeAllowed(
    input.projectId,
    departmentId,
    input.assignedTo ?? viewer.id,
  );

  const dependsOnTaskIds = [
    ...new Set(input.dependsOnTaskIds ?? []),
  ];

  let createStatus: TaskStatus =
    input.status === "blocked" ? "todo" : input.status;
  let completedAt =
    createStatus === "completed" ? new Date().toISOString() : null;

  if (dependsOnTaskIds.length > 0) {
    const { data: depTasks, error: depLookupError } = await admin
      .from("tasks")
      .select("id, project_id, status")
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
    }

    const statuses = (depTasks ?? []).map((row) => row.status as string);
    if (!areDependenciesSatisfied(statuses)) {
      createStatus = "blocked";
      completedAt = null;
    }
  }

  const { data, error } = await admin
    .from("tasks")
    .insert({
      project_id: input.projectId,
      title: input.title,
      description: input.description,
      status: createStatus,
      priority: input.priority,
      assigned_to: input.assignedTo ?? viewer.id,
      created_by: viewer.id,
      start_date: input.startDate,
      due_date: input.dueDate,
      estimated_hours: input.estimatedHours,
      completed_at: completedAt,
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.message?.includes("TASK_DUE_AFTER_PROJECT_END")) {
      throw new ApiError(
        "تاريخ استحقاق المهمة لا يمكن أن يتجاوز تاريخ انتهاء المشروع.",
        400,
        "TASK_DUE_AFTER_PROJECT_END",
      );
    }
    throw new ApiError("تعذر إنشاء المهمة.", 500, "CREATE_TASK_FAILED");
  }

  const created = data as TaskRow;

  await logTaskActivity(viewer.id, created.id, "task.created", {
    title: created.title,
    status: created.status,
    assignedTo: created.assigned_to,
    projectId: created.project_id,
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
    if (!input.assignedTo) {
      throw new ApiError(
        "لا يمكن ترك المهمة بدون معيّن.",
        400,
        "ASSIGNEE_REQUIRED",
      );
    }
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
      "status, assigned_to, title, description, priority, start_date, due_date, estimated_hours, project_id, project:projects!project_id(end_date)",
    )
    .eq("id", taskId)
    .maybeSingle();

  if (existingError || !existing) {
    throw new ApiError("المهمة غير موجودة.", 404, "TASK_NOT_FOUND");
  }

  if (input.dueDate !== undefined) {
    const projectRel = existing.project as
      | { end_date: string }
      | { end_date: string }[]
      | null;
    const project = Array.isArray(projectRel) ? projectRel[0] : projectRel;
    const projectEnd = project?.end_date;
    if (!projectEnd) {
      throw new ApiError("المشروع غير موجود.", 404, "PROJECT_NOT_FOUND");
    }
    assertTaskDueWithinProjectEnd(input.dueDate, projectEnd);
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
    patch.estimated_hours = input.estimatedHours;
  }
  if (input.status !== undefined) {
    if (input.status === "blocked" && existing.status !== "blocked") {
      throw new ApiError(
        "لا يمكن تعيين الحالة إلى معلّقة يدوياً؛ تُحدَّد تلقائياً من التبعيات.",
        400,
        "MANUAL_BLOCKED_STATUS_FORBIDDEN",
      );
    }
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
    return loadTaskForViewer(viewer, taskId);
  }

  const { error } = await admin.from("tasks").update(patch).eq("id", taskId);

  if (error) {
    if (error.message?.includes("TASK_DUE_AFTER_PROJECT_END")) {
      throw new ApiError(
        "تاريخ استحقاق المهمة لا يمكن أن يتجاوز تاريخ انتهاء المشروع.",
        400,
        "TASK_DUE_AFTER_PROJECT_END",
      );
    }
    throw new ApiError("تعذر تحديث المهمة.", 500, "UPDATE_TASK_FAILED");
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
          : Number(existing.estimated_hours)));

  if (otherChanged) {
    await logTaskActivity(viewer.id, taskId, "task.updated", {
      fields: Object.keys(patch).filter(
        (key) => key !== "assigned_to" && key !== "status" && key !== "completed_at",
      ),
    });
  }

  return loadTaskForViewer(viewer, taskId);
}

export async function deleteTask(
  viewer: AppUser,
  taskId: string,
): Promise<void> {
  const access = await assertCanAccessTask(viewer, taskId);
  await assertCanMutateTask(viewer, access);

  const admin = createAdminClient();
  const { error } = await admin.from("tasks").delete().eq("id", taskId);
  if (error) {
    throw new ApiError("تعذر حذف المهمة.", 500, "DELETE_TASK_FAILED");
  }
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
  const allIds = rows.map((r) => r.id);
  const depAggregates = await getDependencyAggregates(allIds);
  const attachmentAggregates = await getAttachmentSummariesByTaskIds(allIds);
  const departmentNames = await getDepartmentNameMap(
    rows
      .map((row) => row.project?.department_id)
      .filter((id): id is string => Boolean(id)),
  );
  const total = count ?? 0;
  const includeEmployeeNumber = viewer.role !== "employee";

  return {
    items: rows.map((row) => {
      const deps = depAggregates.get(row.id);
      return mapTask(row, {
        dependencyCount: deps?.count ?? 0,
        incompleteDependencyCount: deps?.incompleteCount ?? 0,
        incompleteDependencyTitles: deps?.incompleteTitles ?? [],
        incompleteDependencies: deps?.incompleteDependencies ?? [],
        attachments: attachmentAggregates.get(row.id) ?? [],
        includeEmployeeNumber,
        departmentNames,
      });
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
