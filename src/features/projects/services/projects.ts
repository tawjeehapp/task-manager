import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { getManagedDepartmentId, getProjectIdsForUser } from "@/features/departments/services/membership-helpers";
import {
  assertCanAccessProject,
  assertCanCreateProject,
  assertCanManageProject,
} from "@/features/projects/services/assert-can-access-project";
import type {
  CreateProjectInput,
  ListProjectsQuery,
  UpdateProjectInput,
} from "@/features/projects/schemas/project.schema";
import type {
  Project,
  ProjectDepartmentSummary,
  ProjectRow,
  ProjectUserSummary,
  ProjectWithStats,
} from "@/features/projects/types/project.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOverdueTask } from "@/features/dashboard/services/leadership-aggregates";
import { todayInOrgTimezone } from "@/lib/org-calendar";

export type ProjectsListResult = {
  items: Project[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type EmployeeProjectsListResult = {
  items: ProjectWithStats[];
  total: number;
};

type ProjectMemberCountEmbed = { count: number }[];

type ProjectWithRelations = ProjectRow & {
  department: { id: string; name: string } | null;
  created_by_user: {
    id: string;
    full_name: string;
    employee_number: string;
  } | null;
  project_members?: ProjectMemberCountEmbed;
};

const PROJECT_SELECT =
  "id, department_id, name, description, status, priority, start_date, end_date, created_by, created_at, updated_at, department:departments!department_id(id, name), created_by_user:users!created_by(id, full_name, employee_number), project_members(count)";

const SORT_COLUMN_MAP: Record<ListProjectsQuery["sortBy"], string> = {
  name: "name",
  status: "status",
  priority: "priority",
  startDate: "start_date",
  endDate: "end_date",
  createdAt: "created_at",
};

function mapUserSummary(
  row: ProjectWithRelations["created_by_user"],
): ProjectUserSummary | null {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    fullName: row.full_name,
    employeeNumber: row.employee_number,
  };
}

function mapDepartment(
  row: ProjectWithRelations["department"],
): ProjectDepartmentSummary | null {
  if (!row) {
    return null;
  }
  return { id: row.id, name: row.name };
}

function memberCountFromEmbed(
  row: ProjectWithRelations,
): number {
  const embed = row.project_members;
  if (!embed || embed.length === 0) {
    return 0;
  }
  return embed[0]?.count ?? 0;
}

export function mapProject(
  row: ProjectRow,
  department: ProjectDepartmentSummary | null,
  createdByUser: ProjectUserSummary | null,
  memberCount: number,
): Project {
  return {
    id: row.id,
    departmentId: row.department_id,
    department,
    name: row.name,
    description: row.description,
    status: row.status,
    priority: row.priority,
    startDate: row.start_date,
    endDate: row.end_date,
    createdBy: row.created_by,
    createdByUser,
    memberCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadProjectById(id: string): Promise<Project> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new ApiError("تعذر جلب المشروع.", 500, "GET_PROJECT_FAILED");
  }

  if (!data) {
    throw new ApiError("المشروع غير موجود.", 404, "PROJECT_NOT_FOUND");
  }

  const row = data as unknown as ProjectWithRelations;
  return mapProject(
    row,
    mapDepartment(row.department),
    mapUserSummary(row.created_by_user),
    memberCountFromEmbed(row),
  );
}

export { loadProjectById };

export async function getProjectForViewer(
  viewer: AppUser,
  projectId: string,
): Promise<Project> {
  await assertCanAccessProject(viewer, projectId);
  return loadProjectById(projectId);
}

export async function createProject(
  viewer: AppUser,
  input: CreateProjectInput,
): Promise<Project> {
  await assertCanCreateProject(viewer);

  const admin = createAdminClient();

  const { data: department, error: deptError } = await admin
    .from("departments")
    .select("id, status, manager_id")
    .eq("id", input.departmentId)
    .maybeSingle();

  if (deptError) {
    throw new ApiError("تعذر التحقق من القسم.", 500, "DEPARTMENT_CHECK_FAILED");
  }

  if (!department) {
    throw new ApiError("القسم غير موجود.", 404, "DEPARTMENT_NOT_FOUND");
  }

  if (department.status === "archived") {
    throw new ApiError(
      "لا يمكن إنشاء مشروع في قسم مؤرشف.",
      409,
      "DEPARTMENT_ARCHIVED",
    );
  }

  if (!department.manager_id) {
    throw new ApiError(
      "لا يمكن إنشاء مشروع في قسم بدون مدير معيّن.",
      409,
      "DEPARTMENT_HAS_NO_MANAGER",
    );
  }

  const { data, error } = await admin
    .from("projects")
    .insert({
      department_id: input.departmentId,
      name: input.name,
      description: input.description,
      status: input.status,
      priority: input.priority,
      start_date: input.startDate,
      end_date: input.endDate,
      created_by: viewer.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new ApiError("تعذر إنشاء المشروع.", 500, "CREATE_PROJECT_FAILED");
  }

  const project = data as ProjectRow;
  const memberIds = Array.from(new Set(input.memberIds ?? []));

  if (memberIds.length > 0) {
    await validateAndInsertMembers(project.id, project.department_id, memberIds);
  }

  return loadProjectById(project.id);
}

async function validateAndInsertMembers(
  projectId: string,
  departmentId: string,
  userIds: string[],
): Promise<void> {
  const admin = createAdminClient();

  const { data: memberships, error } = await admin
    .from("department_memberships")
    .select("user_id")
    .eq("department_id", departmentId)
    .eq("is_current", true)
    .in("user_id", userIds);

  if (error) {
    throw new ApiError(
      "تعذر التحقق من أعضاء القسم.",
      500,
      "MEMBERSHIP_CHECK_FAILED",
    );
  }

  const allowed = new Set((memberships ?? []).map((m) => m.user_id as string));
  for (const userId of userIds) {
    if (!allowed.has(userId)) {
      throw new ApiError(
        "يجب أن يكون عضو المشروع من أعضاء القسم الحاليين.",
        409,
        "INVALID_PROJECT_MEMBER",
      );
    }
  }

  const { error: insertError } = await admin.from("project_members").insert(
    userIds.map((userId) => ({
      project_id: projectId,
      user_id: userId,
    })),
  );

  if (insertError) {
    throw new ApiError(
      "تعذر إضافة أعضاء المشروع.",
      500,
      "ADD_PROJECT_MEMBERS_FAILED",
    );
  }
}

export async function updateProject(
  viewer: AppUser,
  projectId: string,
  input: UpdateProjectInput,
): Promise<Project> {
  await assertCanManageProject(viewer, projectId);

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) {
    patch.name = input.name;
  }
  if (input.description !== undefined) {
    patch.description = input.description;
  }
  if (input.status !== undefined) {
    patch.status = input.status;
  }
  if (input.priority !== undefined) {
    patch.priority = input.priority;
  }
  if (input.startDate !== undefined) {
    patch.start_date = input.startDate;
  }
  if (input.endDate !== undefined) {
    patch.end_date = input.endDate;
  }

  const { error } = await admin
    .from("projects")
    .update(patch)
    .eq("id", projectId);

  if (error) {
    throw new ApiError("تعذر تحديث المشروع.", 500, "UPDATE_PROJECT_FAILED");
  }

  return loadProjectById(projectId);
}

export async function listProjectsForViewer(
  viewer: AppUser,
  query: ListProjectsQuery,
): Promise<ProjectsListResult> {
  const admin = createAdminClient();
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  const sortColumn = SORT_COLUMN_MAP[query.sortBy];

  let projectIdsFilter: string[] | null = null;
  let managedDepartmentId: string | null = null;

  if (query.memberUserId) {
    const ownIds = await getProjectIdsForUser(query.memberUserId);
    projectIdsFilter = ownIds;
    if (projectIdsFilter.length === 0) {
      return emptyResult(query);
    }
  }

  if (viewer.role === "department_manager") {
    managedDepartmentId = await getManagedDepartmentId(viewer.id);
    if (!managedDepartmentId) {
      return emptyResult(query);
    }
    if (query.departmentId && query.departmentId !== managedDepartmentId) {
      return emptyResult(query);
    }
  } else if (viewer.role === "employee") {
    const ownIds = await getProjectIdsForUser(viewer.id);
    if (ownIds.length === 0) {
      return emptyResult(query);
    }
    projectIdsFilter = projectIdsFilter
      ? projectIdsFilter.filter((id) => ownIds.includes(id))
      : ownIds;
    if (projectIdsFilter.length === 0) {
      return emptyResult(query);
    }
  }

  let builder = admin
    .from("projects")
    .select(PROJECT_SELECT, { count: "exact" });

  if (viewer.role === "department_manager") {
    builder = builder.eq("department_id", managedDepartmentId!);
  }

  if (projectIdsFilter) {
    builder = builder.in("id", projectIdsFilter);
  }

  if (query.departmentId) {
    builder = builder.eq("department_id", query.departmentId);
  }

  if (query.status) {
    builder = builder.eq("status", query.status);
  } else if (!query.includeArchived) {
    builder = builder.neq("status", "archived");
  }

  builder = builder
    .order(sortColumn, { ascending: query.sortDir === "asc" })
    .range(from, to);

  const { data, error, count } = await builder;

  if (error) {
    throw new ApiError("تعذر جلب المشاريع.", 500, "LIST_PROJECTS_FAILED");
  }

  const rows = (data ?? []) as unknown as ProjectWithRelations[];
  const total = count ?? 0;

  return {
    items: rows.map((row) =>
      mapProject(
        row,
        mapDepartment(row.department),
        mapUserSummary(row.created_by_user),
        memberCountFromEmbed(row),
      ),
    ),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

function emptyResult(query: ListProjectsQuery): ProjectsListResult {
  return {
    items: [],
    total: 0,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: 1,
  };
}

type TaskStatRow = {
  id: string;
  project_id: string;
  status: string;
  due_date: string | null;
};

async function loadDepartmentMemberCounts(
  departmentIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (departmentIds.length === 0) {
    return counts;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("department_memberships")
    .select("department_id")
    .in("department_id", departmentIds)
    .eq("is_current", true);

  if (error) {
    throw new ApiError(
      "تعذر حساب أعضاء الأقسام.",
      500,
      "DEPARTMENT_MEMBER_COUNT_FAILED",
    );
  }

  for (const row of data ?? []) {
    const id = row.department_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

async function loadProjectTaskStats(
  projectIds: string[],
  today: string,
): Promise<
  Map<
    string,
    {
      progressPercent: number;
      taskCount: number;
      completedTaskCount: number;
      overdueCount: number;
    }
  >
> {
  const stats = new Map<
    string,
    {
      progressPercent: number;
      taskCount: number;
      completedTaskCount: number;
      overdueCount: number;
    }
  >();

  for (const id of projectIds) {
    stats.set(id, {
      progressPercent: 0,
      taskCount: 0,
      completedTaskCount: 0,
      overdueCount: 0,
    });
  }

  if (projectIds.length === 0) {
    return stats;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tasks")
    .select("id, project_id, status, due_date")
    .in("project_id", projectIds);

  if (error) {
    throw new ApiError(
      "تعذر حساب إحصاءات المهام.",
      500,
      "PROJECT_TASK_STATS_FAILED",
    );
  }

  const allByProject = new Map<string, TaskStatRow[]>();

  for (const row of (data ?? []) as TaskStatRow[]) {
    const all = allByProject.get(row.project_id) ?? [];
    all.push(row);
    allByProject.set(row.project_id, all);
  }

  for (const projectId of projectIds) {
    const all = allByProject.get(projectId) ?? [];
    const completedTaskCount = all.filter(
      (task) => task.status === "completed",
    ).length;
    const taskCount = all.length;
    const progressPercent =
      taskCount === 0
        ? 0
        : Math.round((completedTaskCount / taskCount) * 100);
    const overdueCount = all.filter((task) =>
      isOverdueTask(
        {
          status: task.status,
          dueDate: task.due_date ? String(task.due_date).slice(0, 10) : null,
        },
        today,
      ),
    ).length;

    stats.set(projectId, {
      progressPercent,
      taskCount,
      completedTaskCount,
      overdueCount,
    });
  }

  return stats;
}

/**
 * Viewer-scoped projects with progress / task / overdue stats for the
 * department card list (employees + department managers). Returns all
 * matching projects (no pagination).
 */
export async function listEmployeeProjectsWithStats(
  viewer: AppUser,
): Promise<EmployeeProjectsListResult> {
  if (viewer.role !== "employee" && viewer.role !== "department_manager") {
    throw new ApiError(
      "هذه الواجهة مخصصة للموظفين ومديري الأقسام.",
      403,
      "FORBIDDEN",
    );
  }

  const base = await listProjectsForViewer(viewer, {
    page: 1,
    pageSize: 100,
    includeArchived: false,
    includeStats: false,
    sortBy: "name",
    sortDir: "asc",
  });

  // If the employee has more than one page, fetch remaining pages.
  let items = [...base.items];
  if (base.totalPages > 1) {
    for (let page = 2; page <= base.totalPages; page += 1) {
      const next = await listProjectsForViewer(viewer, {
        page,
        pageSize: 100,
        includeArchived: false,
        includeStats: false,
        sortBy: "name",
        sortDir: "asc",
      });
      items = items.concat(next.items);
    }
  }

  const projectIds = items.map((item) => item.id);
  const departmentIds = [
    ...new Set(items.map((item) => item.departmentId).filter(Boolean)),
  ];
  const today = todayInOrgTimezone();

  const [taskStats, departmentMemberCounts] = await Promise.all([
    loadProjectTaskStats(projectIds, today),
    loadDepartmentMemberCounts(departmentIds),
  ]);

  const withStats: ProjectWithStats[] = items.map((item) => {
    const stats = taskStats.get(item.id) ?? {
      progressPercent: 0,
      taskCount: 0,
      completedTaskCount: 0,
      overdueCount: 0,
    };
    return {
      ...item,
      ...stats,
      departmentMemberCount: departmentMemberCounts.get(item.departmentId) ?? 0,
    };
  });

  return { items: withStats, total: withStats.length };
}
