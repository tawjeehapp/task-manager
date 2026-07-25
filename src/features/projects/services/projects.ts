import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { getManagedDepartmentId } from "@/features/departments/services/membership-helpers";
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
} from "@/features/projects/types/project.types";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProjectsListResult = {
  items: Project[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type ProjectWithRelations = ProjectRow & {
  department: { id: string; name: string } | null;
  created_by_user: {
    id: string;
    full_name: string;
    employee_number: string;
  } | null;
};

const PROJECT_SELECT =
  "id, department_id, name, description, status, priority, start_date, end_date, created_by, created_at, updated_at, department:departments!department_id(id, name), created_by_user:users!created_by(id, full_name, employee_number)";

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

async function getMemberCounts(
  projectIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (projectIds.length === 0) {
    return counts;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("project_members")
    .select("project_id")
    .in("project_id", projectIds);

  if (error) {
    throw new ApiError(
      "تعذر حساب أعضاء المشاريع.",
      500,
      "MEMBER_COUNT_FAILED",
    );
  }

  for (const row of data ?? []) {
    const id = row.project_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return counts;
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
  const counts = await getMemberCounts([row.id]);
  return mapProject(
    row,
    mapDepartment(row.department),
    mapUserSummary(row.created_by_user),
    counts.get(row.id) ?? 0,
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
    .select("id, status")
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

  if (query.memberUserId) {
    const { data: memberships, error: memberError } = await admin
      .from("project_members")
      .select("project_id")
      .eq("user_id", query.memberUserId);

    if (memberError) {
      throw new ApiError("تعذر جلب المشاريع.", 500, "LIST_PROJECTS_FAILED");
    }

    projectIdsFilter = (memberships ?? []).map((m) => m.project_id as string);
    if (projectIdsFilter.length === 0) {
      return emptyResult(query);
    }
  }

  if (viewer.role === "department_manager") {
    const managedId = await getManagedDepartmentId(viewer.id);
    if (!managedId) {
      return emptyResult(query);
    }
    if (query.departmentId && query.departmentId !== managedId) {
      return emptyResult(query);
    }
  } else if (viewer.role === "employee") {
    const { data: memberships, error } = await admin
      .from("project_members")
      .select("project_id")
      .eq("user_id", viewer.id);

    if (error) {
      throw new ApiError("تعذر جلب المشاريع.", 500, "LIST_PROJECTS_FAILED");
    }

    const ownIds = (memberships ?? []).map((m) => m.project_id as string);
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
    const managedId = await getManagedDepartmentId(viewer.id);
    builder = builder.eq("department_id", managedId!);
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
  const counts = await getMemberCounts(rows.map((r) => r.id));
  const total = count ?? 0;

  return {
    items: rows.map((row) =>
      mapProject(
        row,
        mapDepartment(row.department),
        mapUserSummary(row.created_by_user),
        counts.get(row.id) ?? 0,
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
