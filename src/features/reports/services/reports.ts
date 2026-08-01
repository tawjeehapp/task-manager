import "server-only";

import { getManagedDepartmentId } from "@/features/departments/services/membership-helpers";
import type {
  AttendanceSummaryQuery,
  EmployeeWorkloadQuery,
  TaskCompletionQuery,
  WorkLogSummaryQuery,
} from "@/features/reports/schemas/report.schema";
import type {
  AttendanceSummaryRow,
  EmployeeWorkloadRow,
  ReportListResult,
  TaskCompletionRow,
  WorkLogSummaryRow,
} from "@/features/reports/types/report.types";
import { ACTIVE_TASK_STATUSES } from "@/features/tasks/types/task.types";
import { computeEmployeeWorkload } from "@/features/tasks/services/workload";
import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import {
  addCalendarDays,
  currentMonthBounds,
  todayInOrgTimezone,
} from "@/lib/org-calendar";
import { SYSTEM_ADMIN_EMPLOYEE_NUMBER } from "@/lib/table/constants";
import { createAdminClient } from "@/lib/supabase/admin";

type ScopedUsers = {
  userIds: string[];
  departmentNameByUserId: Map<string, string | null>;
  userMeta: Map<
    string,
    { fullName: string; employeeNumber: string }
  >;
};

function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): ReportListResult<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

function defaultDateRange(query: {
  dateFrom?: string;
  dateTo?: string;
}): { dateFrom: string; dateTo: string } {
  const today = todayInOrgTimezone();
  const bounds = currentMonthBounds(today);
  return {
    dateFrom: query.dateFrom ?? bounds.start,
    dateTo: query.dateTo ?? bounds.end,
  };
}

async function assertReportAccess(viewer: AppUser): Promise<string | null> {
  if (viewer.role === "admin") {
    return null;
  }
  if (viewer.role === "department_manager") {
    const deptId = await getManagedDepartmentId(viewer.id);
    if (!deptId) {
      throw new ApiError(
        "لا يوجد قسم مُدار لهذا الحساب.",
        403,
        "NO_MANAGED_DEPARTMENT",
      );
    }
    return deptId;
  }
  throw new ApiError("ليس لديك صلاحية عرض التقارير.", 403, "FORBIDDEN");
}

async function resolveScopedUsers(
  viewer: AppUser,
  options: {
    departmentId?: string;
    userId?: string;
  },
): Promise<ScopedUsers> {
  const managedDeptId = await assertReportAccess(viewer);
  const admin = createAdminClient();

  let departmentFilter = managedDeptId;
  if (viewer.role === "admin" && options.departmentId) {
    departmentFilter = options.departmentId;
  } else if (
    viewer.role === "department_manager" &&
    options.departmentId &&
    options.departmentId !== managedDeptId
  ) {
    throw new ApiError(
      "لا يمكنك عرض تقارير قسم آخر.",
      403,
      "FORBIDDEN_DEPARTMENT",
    );
  }

  let membershipQuery = admin
    .from("department_memberships")
    .select("user_id, department:departments!department_id(id, name)")
    .eq("is_current", true);

  if (departmentFilter) {
    membershipQuery = membershipQuery.eq("department_id", departmentFilter);
  }

  const { data: memberships, error: membershipError } = await membershipQuery;
  if (membershipError) {
    throw new ApiError(
      "تعذر جلب أعضاء التقارير.",
      500,
      "REPORT_MEMBERS_FAILED",
    );
  }

  const departmentNameByUserId = new Map<string, string | null>();
  const memberIds: string[] = [];
  for (const row of memberships ?? []) {
    const userId = row.user_id as string;
    memberIds.push(userId);
    const dept = row.department as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
    const name = Array.isArray(dept)
      ? (dept[0]?.name ?? null)
      : (dept?.name ?? null);
    departmentNameByUserId.set(userId, name);
  }

  let usersQuery = admin
    .from("users")
    .select("id, full_name, employee_number, is_active")
    .eq("is_active", true)
    .neq("employee_number", SYSTEM_ADMIN_EMPLOYEE_NUMBER);

  if (departmentFilter) {
    if (memberIds.length === 0) {
      return {
        userIds: [],
        departmentNameByUserId,
        userMeta: new Map(),
      };
    }
    usersQuery = usersQuery.in("id", memberIds);
  }

  if (options.userId) {
    usersQuery = usersQuery.eq("id", options.userId);
  }

  const { data: users, error: usersError } = await usersQuery;
  if (usersError) {
    throw new ApiError(
      "تعذر جلب الموظفين للتقرير.",
      500,
      "REPORT_USERS_FAILED",
    );
  }

  const userMeta = new Map<string, { fullName: string; employeeNumber: string }>();
  const userIds: string[] = [];
  for (const row of users ?? []) {
    const id = row.id as string;
    userIds.push(id);
    userMeta.set(id, {
      fullName: row.full_name as string,
      employeeNumber: row.employee_number as string,
    });
    if (!departmentNameByUserId.has(id)) {
      departmentNameByUserId.set(id, null);
    }
  }

  return { userIds, departmentNameByUserId, userMeta };
}

function sortRows<T>(
  rows: T[],
  sortBy: keyof T,
  sortDir: "asc" | "desc",
): T[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[sortBy];
    const bv = b[sortBy];
    if (typeof av === "string" && typeof bv === "string") {
      return av.localeCompare(bv, "ar") * dir;
    }
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * dir;
    }
    return 0;
  });
}

export async function listTaskCompletionReport(
  viewer: AppUser,
  query: TaskCompletionQuery,
): Promise<ReportListResult<TaskCompletionRow>> {
  const { dateFrom, dateTo } = defaultDateRange(query);
  const scoped = await resolveScopedUsers(viewer, {
    departmentId: query.departmentId,
    userId: query.assigneeId ?? query.userId,
  });

  if (scoped.userIds.length === 0) {
    return paginate([], query.page, query.pageSize);
  }

  const admin = createAdminClient();
  let tasksQuery = admin
    .from("tasks")
    .select("id, assigned_to, status, completed_at, project_id, project:projects!project_id(id, department_id)")
    .in("assigned_to", scoped.userIds);

  if (query.projectId) {
    tasksQuery = tasksQuery.eq("project_id", query.projectId);
  }

  const { data: tasks, error } = await tasksQuery;
  if (error) {
    throw new ApiError(
      "تعذر جلب تقرير إنجاز المهام.",
      500,
      "REPORT_TASK_COMPLETION_FAILED",
    );
  }

  const managedDeptId =
    viewer.role === "department_manager"
      ? await getManagedDepartmentId(viewer.id)
      : query.departmentId ?? null;

  type Acc = { completed: number; total: number };
  const byUser = new Map<string, Acc>();
  for (const userId of scoped.userIds) {
    byUser.set(userId, { completed: 0, total: 0 });
  }

  const rangeStart = `${dateFrom}T00:00:00.000Z`;
  const rangeEndExclusive = `${addCalendarDays(dateTo, 1)}T00:00:00.000Z`;

  for (const row of tasks ?? []) {
    const assignee = row.assigned_to as string | null;
    if (!assignee || !byUser.has(assignee)) continue;

    const project = row.project as
      | { id: string; department_id: string }
      | { id: string; department_id: string }[]
      | null;
    const departmentId = Array.isArray(project)
      ? project[0]?.department_id
      : project?.department_id;

    if (managedDeptId && departmentId && departmentId !== managedDeptId) {
      continue;
    }
    if (
      viewer.role === "admin" &&
      query.departmentId &&
      departmentId &&
      departmentId !== query.departmentId
    ) {
      continue;
    }

    const acc = byUser.get(assignee)!;
    const status = row.status as string;
    const completedAt = row.completed_at as string | null;

    const inRangeCompleted =
      status === "completed" &&
      completedAt !== null &&
      completedAt >= rangeStart &&
      completedAt < rangeEndExclusive;

    // Total = tasks that were completed in range OR still open (active work snapshot)
    if (inRangeCompleted || status !== "completed") {
      acc.total += 1;
    }
    if (inRangeCompleted) {
      acc.completed += 1;
    }
  }

  let rows: TaskCompletionRow[] = [];
  for (const userId of scoped.userIds) {
    const meta = scoped.userMeta.get(userId);
    if (!meta) continue;
    const acc = byUser.get(userId) ?? { completed: 0, total: 0 };
    const completionRate =
      acc.total === 0
        ? 0
        : Math.round((acc.completed / acc.total) * 1000) / 10;
    rows.push({
      userId,
      fullName: meta.fullName,
      employeeNumber: meta.employeeNumber,
      departmentName: scoped.departmentNameByUserId.get(userId) ?? null,
      completedCount: acc.completed,
      totalCount: acc.total,
      completionRate,
    });
  }

  rows = sortRows(rows, query.sortBy, query.sortDir);
  return paginate(rows, query.page, query.pageSize);
}

export async function listEmployeeWorkloadReport(
  viewer: AppUser,
  query: EmployeeWorkloadQuery,
): Promise<ReportListResult<EmployeeWorkloadRow>> {
  const scoped = await resolveScopedUsers(viewer, {
    departmentId: query.departmentId,
    userId: query.userId,
  });

  if (scoped.userIds.length === 0) {
    return paginate([], query.page, query.pageSize);
  }

  const admin = createAdminClient();
  const { data: tasks, error } = await admin
    .from("tasks")
    .select("assigned_to, status, estimated_hours")
    .in("assigned_to", scoped.userIds)
    .in("status", [...ACTIVE_TASK_STATUSES]);

  if (error) {
    throw new ApiError(
      "تعذر جلب تقرير عبء العمل.",
      500,
      "REPORT_WORKLOAD_FAILED",
    );
  }

  const byUser = new Map<
    string,
    Array<{ status: string; estimatedHours: number | null }>
  >();
  for (const id of scoped.userIds) byUser.set(id, []);
  for (const row of tasks ?? []) {
    const assignee = row.assigned_to as string | null;
    if (!assignee || !byUser.has(assignee)) continue;
    byUser.get(assignee)!.push({
      status: row.status as string,
      estimatedHours:
        row.estimated_hours === null || row.estimated_hours === undefined
          ? null
          : Number(row.estimated_hours),
    });
  }

  let rows: EmployeeWorkloadRow[] = [];
  for (const userId of scoped.userIds) {
    const meta = scoped.userMeta.get(userId);
    if (!meta) continue;
    const workload = computeEmployeeWorkload(userId, byUser.get(userId) ?? []);
    rows.push({
      userId,
      fullName: meta.fullName,
      employeeNumber: meta.employeeNumber,
      departmentName: scoped.departmentNameByUserId.get(userId) ?? null,
      activeTaskCount: workload.activeTaskCount,
      estimatedHours: workload.estimatedHours,
    });
  }

  rows = sortRows(rows, query.sortBy, query.sortDir);
  return paginate(rows, query.page, query.pageSize);
}

export async function listAttendanceSummaryReport(
  viewer: AppUser,
  query: AttendanceSummaryQuery,
): Promise<ReportListResult<AttendanceSummaryRow>> {
  const { dateFrom, dateTo } = defaultDateRange(query);
  const scoped = await resolveScopedUsers(viewer, {
    departmentId: query.departmentId,
    userId: query.userId,
  });

  if (scoped.userIds.length === 0) {
    return paginate([], query.page, query.pageSize);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("attendance_records")
    .select("user_id, status, total_hours")
    .in("user_id", scoped.userIds)
    .gte("date", dateFrom)
    .lte("date", dateTo);

  if (error) {
    throw new ApiError(
      "تعذر جلب تقرير الحضور.",
      500,
      "REPORT_ATTENDANCE_FAILED",
    );
  }

  type Acc = {
    days: number;
    totalHours: number;
    approvedDays: number;
    pendingDays: number;
    rejectedDays: number;
  };
  const byUser = new Map<string, Acc>();
  for (const id of scoped.userIds) {
    byUser.set(id, {
      days: 0,
      totalHours: 0,
      approvedDays: 0,
      pendingDays: 0,
      rejectedDays: 0,
    });
  }

  for (const row of data ?? []) {
    const userId = row.user_id as string;
    const acc = byUser.get(userId);
    if (!acc) continue;
    acc.days += 1;
    const hours = Number(row.total_hours ?? 0);
    if (Number.isFinite(hours)) acc.totalHours += hours;
    if (row.status === "approved") acc.approvedDays += 1;
    else if (row.status === "pending") acc.pendingDays += 1;
    else if (row.status === "rejected") acc.rejectedDays += 1;
  }

  let rows: AttendanceSummaryRow[] = [];
  for (const userId of scoped.userIds) {
    const meta = scoped.userMeta.get(userId);
    if (!meta) continue;
    const acc = byUser.get(userId)!;
    rows.push({
      userId,
      fullName: meta.fullName,
      employeeNumber: meta.employeeNumber,
      departmentName: scoped.departmentNameByUserId.get(userId) ?? null,
      days: acc.days,
      totalHours: Math.round(acc.totalHours * 100) / 100,
      approvedDays: acc.approvedDays,
      pendingDays: acc.pendingDays,
      rejectedDays: acc.rejectedDays,
    });
  }

  rows = sortRows(rows, query.sortBy, query.sortDir);
  return paginate(rows, query.page, query.pageSize);
}

export async function listWorkLogSummaryReport(
  viewer: AppUser,
  query: WorkLogSummaryQuery,
): Promise<ReportListResult<WorkLogSummaryRow>> {
  const { dateFrom, dateTo } = defaultDateRange(query);
  const scoped = await resolveScopedUsers(viewer, {
    departmentId: query.departmentId,
    userId: query.userId,
  });

  if (scoped.userIds.length === 0) {
    return paginate([], query.page, query.pageSize);
  }

  const admin = createAdminClient();
  let logsQuery = admin
    .from("work_logs")
    .select("user_id, hours, task_id, task:tasks!task_id(id, project_id)")
    .in("user_id", scoped.userIds)
    .gte("date", dateFrom)
    .lte("date", dateTo);

  if (query.taskId) {
    logsQuery = logsQuery.eq("task_id", query.taskId);
  }

  const { data, error } = await logsQuery;
  if (error) {
    throw new ApiError(
      "تعذر جلب تقرير سجلات العمل.",
      500,
      "REPORT_WORK_LOG_FAILED",
    );
  }

  type Acc = { logEntries: number; loggedHours: number };
  const byUser = new Map<string, Acc>();
  for (const id of scoped.userIds) {
    byUser.set(id, { logEntries: 0, loggedHours: 0 });
  }

  for (const row of data ?? []) {
    const userId = row.user_id as string;
    const acc = byUser.get(userId);
    if (!acc) continue;

    if (query.projectId) {
      const task = row.task as
        | { id: string; project_id: string }
        | { id: string; project_id: string }[]
        | null;
      const projectId = Array.isArray(task)
        ? task[0]?.project_id
        : task?.project_id;
      if (projectId !== query.projectId) continue;
    }

    acc.logEntries += 1;
    const hours = Number(row.hours ?? 0);
    if (Number.isFinite(hours)) acc.loggedHours += hours;
  }

  let rows: WorkLogSummaryRow[] = [];
  for (const userId of scoped.userIds) {
    const meta = scoped.userMeta.get(userId);
    if (!meta) continue;
    const acc = byUser.get(userId)!;
    rows.push({
      userId,
      fullName: meta.fullName,
      employeeNumber: meta.employeeNumber,
      departmentName: scoped.departmentNameByUserId.get(userId) ?? null,
      logEntries: acc.logEntries,
      loggedHours: Math.round(acc.loggedHours * 100) / 100,
    });
  }

  rows = sortRows(rows, query.sortBy, query.sortDir);
  return paginate(rows, query.page, query.pageSize);
}
