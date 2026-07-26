import "server-only";

import { calendarDateInOrgTimezone } from "@/features/attendance/services/compute-hours";
import {
  ATTENDANCE_TIMEZONE,
  deriveAttendanceUiState,
  type AttendanceStatus,
} from "@/features/attendance/types/attendance.types";
import { getManagedDepartmentId } from "@/features/departments/services/membership-helpers";
import { ACTIVE_TASK_STATUSES } from "@/features/tasks/types/task.types";
import { computeEmployeeWorkload } from "@/features/tasks/services/workload";
import {
  DASHBOARD_LIST_LIMIT,
  type AdminDashboard,
  type DashboardAttendanceItem,
  type DashboardAttendanceSummary,
  type DashboardProjectItem,
  type DashboardRequestItem,
  type DashboardSummary,
  type DashboardTaskItem,
  type DashboardWorkloadItem,
  type EmployeeDashboard,
  type EmployeeDashboardMetrics,
  type ManagerDashboard,
  type PendingApprovalsBreakdown,
} from "@/features/dashboard/types/dashboard.types";
import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import {
  addCalendarDays,
  currentMonthBounds,
  currentWeekBounds,
} from "@/lib/org-calendar";
import { SYSTEM_ADMIN_EMPLOYEE_NUMBER } from "@/lib/table/constants";
import { createAdminClient } from "@/lib/supabase/admin";

function emptyPending(): PendingApprovalsBreakdown {
  return { leave: 0, extension: 0, excusal: 0, attendance: 0, total: 0 };
}

async function listDepartmentMemberIds(
  departmentId: string,
): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("department_memberships")
    .select("user_id")
    .eq("department_id", departmentId)
    .eq("is_current", true);

  if (error) {
    throw new ApiError(
      "تعذر جلب أعضاء القسم.",
      500,
      "DASHBOARD_MEMBERS_FAILED",
    );
  }

  return (data ?? []).map((row) => row.user_id as string);
}

async function countPendingApprovals(
  userIds: string[] | null,
): Promise<PendingApprovalsBreakdown> {
  const admin = createAdminClient();
  const result = emptyPending();

  if (userIds && userIds.length === 0) {
    return result;
  }

  let leaveQ = admin
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (userIds) leaveQ = leaveQ.in("user_id", userIds);
  const leave = await leaveQ;
  if (leave.error) {
    throw new ApiError(
      "تعذر جلب الاعتمادات المعلقة.",
      500,
      "DASHBOARD_PENDING_FAILED",
    );
  }
  result.leave = leave.count ?? 0;

  let extQ = admin
    .from("employee_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .eq("type", "extension");
  if (userIds) extQ = extQ.in("user_id", userIds);
  const extension = await extQ;
  if (extension.error) {
    throw new ApiError(
      "تعذر جلب الاعتمادات المعلقة.",
      500,
      "DASHBOARD_PENDING_FAILED",
    );
  }
  result.extension = extension.count ?? 0;

  let excQ = admin
    .from("employee_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .eq("type", "excusal");
  if (userIds) excQ = excQ.in("user_id", userIds);
  const excusal = await excQ;
  if (excusal.error) {
    throw new ApiError(
      "تعذر جلب الاعتمادات المعلقة.",
      500,
      "DASHBOARD_PENDING_FAILED",
    );
  }
  result.excusal = excusal.count ?? 0;

  let attQ = admin
    .from("attendance_records")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .not("clock_out", "is", null);
  if (userIds) attQ = attQ.in("user_id", userIds);
  const attendance = await attQ;
  if (attendance.error) {
    throw new ApiError(
      "تعذر جلب الاعتمادات المعلقة.",
      500,
      "DASHBOARD_PENDING_FAILED",
    );
  }
  result.attendance = attendance.count ?? 0;

  result.total =
    result.leave + result.extension + result.excusal + result.attendance;
  return result;
}

async function buildWorkload(
  userIds: string[],
): Promise<DashboardWorkloadItem[]> {
  if (userIds.length === 0) return [];

  const admin = createAdminClient();
  const { data: users, error: usersError } = await admin
    .from("users")
    .select("id, full_name, employee_number, is_active")
    .in("id", userIds)
    .eq("is_active", true)
    .neq("employee_number", SYSTEM_ADMIN_EMPLOYEE_NUMBER);

  if (usersError) {
    throw new ApiError(
      "تعذر جلب عبء العمل.",
      500,
      "DASHBOARD_WORKLOAD_FAILED",
    );
  }

  const activeIds = (users ?? []).map((u) => u.id as string);
  if (activeIds.length === 0) return [];

  const { data: tasks, error: tasksError } = await admin
    .from("tasks")
    .select("assigned_to, status, estimated_hours")
    .in("assigned_to", activeIds)
    .in("status", [...ACTIVE_TASK_STATUSES]);

  if (tasksError) {
    throw new ApiError(
      "تعذر جلب عبء العمل.",
      500,
      "DASHBOARD_WORKLOAD_FAILED",
    );
  }

  const byUser = new Map<string, Array<{ status: string; estimatedHours: number | null }>>();
  for (const id of activeIds) {
    byUser.set(id, []);
  }
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

  const userMap = new Map(
    (users ?? []).map((u) => [
      u.id as string,
      {
        fullName: u.full_name as string,
        employeeNumber: u.employee_number as string,
      },
    ]),
  );

  const items: DashboardWorkloadItem[] = [];
  for (const userId of activeIds) {
    const meta = userMap.get(userId);
    if (!meta) continue;
    const workload = computeEmployeeWorkload(userId, byUser.get(userId) ?? []);
    items.push({
      userId,
      fullName: meta.fullName,
      employeeNumber: meta.employeeNumber,
      activeTaskCount: workload.activeTaskCount,
      estimatedHours: workload.estimatedHours,
      href: `/employees/${userId}`,
    });
  }

  items.sort((a, b) => {
    if (b.estimatedHours !== a.estimatedHours) {
      return b.estimatedHours - a.estimatedHours;
    }
    return b.activeTaskCount - a.activeTaskCount;
  });

  return items.slice(0, DASHBOARD_LIST_LIMIT);
}

async function listDepartmentProjects(
  departmentId: string,
): Promise<DashboardProjectItem[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .select("id, name, status")
    .eq("department_id", departmentId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(DASHBOARD_LIST_LIMIT);

  if (error) {
    throw new ApiError(
      "تعذر جلب مشاريع القسم.",
      500,
      "DASHBOARD_PROJECTS_FAILED",
    );
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    status: row.status as string,
    href: `/projects/${row.id}`,
  }));
}

async function listOverdueTasks(
  projectIds: string[],
  today: string,
): Promise<DashboardTaskItem[]> {
  if (projectIds.length === 0) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tasks")
    .select("id, title, status, due_date, project:projects!project_id(id, name)")
    .in("project_id", projectIds)
    .neq("status", "completed")
    .not("due_date", "is", null)
    .lt("due_date", today)
    .order("due_date", { ascending: true })
    .limit(DASHBOARD_LIST_LIMIT);

  if (error) {
    throw new ApiError(
      "تعذر جلب المهام المتأخرة.",
      500,
      "DASHBOARD_OVERDUE_FAILED",
    );
  }

  return (data ?? []).map((row) => {
    const project = row.project as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
    const projectName = Array.isArray(project)
      ? (project[0]?.name ?? null)
      : (project?.name ?? null);
    return {
      id: row.id as string,
      title: row.title as string,
      status: row.status as string,
      dueDate: (row.due_date as string | null) ?? null,
      projectName,
      href: `/tasks/${row.id}`,
    };
  });
}

async function getAttendanceSummary(
  userId: string,
  today: string,
): Promise<DashboardAttendanceSummary> {
  const { start, end, month } = currentMonthBounds(today);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("attendance_records")
    .select("status, total_hours")
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end);

  if (error) {
    throw new ApiError(
      "تعذر جلب ملخص الحضور.",
      500,
      "DASHBOARD_ATTENDANCE_FAILED",
    );
  }

  let totalHours = 0;
  let approvedDays = 0;
  let pendingDays = 0;
  let rejectedDays = 0;

  for (const row of data ?? []) {
    const hours = Number(row.total_hours ?? 0);
    if (Number.isFinite(hours)) totalHours += hours;
    if (row.status === "approved") approvedDays += 1;
    else if (row.status === "pending") pendingDays += 1;
    else if (row.status === "rejected") rejectedDays += 1;
  }

  return {
    month,
    totalHours: Math.round(totalHours * 100) / 100,
    approvedDays,
    pendingDays,
    rejectedDays,
    href: "/attendance",
  };
}

async function listMyRequests(userId: string): Promise<DashboardRequestItem[]> {
  const admin = createAdminClient();

  const [leaveRes, empRes] = await Promise.all([
    admin
      .from("leave_requests")
      .select("id, status, created_at, leave_type:leave_types!leave_type_id(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(DASHBOARD_LIST_LIMIT),
    admin
      .from("employee_requests")
      .select("id, type, status, created_at, task_id, task:tasks!task_id(title)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(DASHBOARD_LIST_LIMIT),
  ]);

  if (leaveRes.error || empRes.error) {
    throw new ApiError(
      "تعذر جلب الطلبات.",
      500,
      "DASHBOARD_REQUESTS_FAILED",
    );
  }

  const items: DashboardRequestItem[] = [];

  for (const row of leaveRes.data ?? []) {
    const leaveType = row.leave_type as
      | { name: string }
      | { name: string }[]
      | null;
    const typeName = Array.isArray(leaveType)
      ? (leaveType[0]?.name ?? "إجازة")
      : (leaveType?.name ?? "إجازة");
    items.push({
      id: row.id as string,
      kind: "leave",
      title: typeName,
      status: row.status as string,
      createdAt: row.created_at as string,
      href: "/leave",
    });
  }

  for (const row of empRes.data ?? []) {
    const task = row.task as
      | { title: string }
      | { title: string }[]
      | null;
    const taskTitle = Array.isArray(task)
      ? (task[0]?.title ?? "")
      : (task?.title ?? "");
    const kind = row.type as "extension" | "excusal";
    const taskId = row.task_id as string | null;
    items.push({
      id: row.id as string,
      kind,
      title: taskTitle || (kind === "extension" ? "تمديد مهمة" : "إعفاء من مهمة"),
      status: row.status as string,
      createdAt: row.created_at as string,
      href: taskId ? `/tasks/${taskId}` : "/tasks",
    });
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return items.slice(0, DASHBOARD_LIST_LIMIT);
}

function mapTaskRow(row: {
  id: unknown;
  title: unknown;
  status: unknown;
  due_date: unknown;
  project: unknown;
}): DashboardTaskItem {
  const project = row.project as
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
  const projectName = Array.isArray(project)
    ? (project[0]?.name ?? null)
    : (project?.name ?? null);
  return {
    id: row.id as string,
    title: row.title as string,
    status: row.status as string,
    dueDate: (row.due_date as string | null) ?? null,
    projectName,
    href: `/tasks/${row.id}`,
  };
}

async function getEmployeeMetrics(
  userId: string,
  today: string,
): Promise<EmployeeDashboardMetrics> {
  const { start: weekStart, end: weekEnd } = currentWeekBounds(today);
  const admin = createAdminClient();

  const [tasksRes, weekAttRes] = await Promise.all([
    admin
      .from("tasks")
      .select("id, status, due_date")
      .eq("assigned_to", userId)
      .is("parent_task_id", null),
    admin
      .from("attendance_records")
      .select("total_hours")
      .eq("user_id", userId)
      .gte("date", weekStart)
      .lte("date", weekEnd),
  ]);

  if (tasksRes.error) {
    throw new ApiError(
      "تعذر جلب مقاييس المهام.",
      500,
      "DASHBOARD_METRICS_FAILED",
    );
  }
  if (weekAttRes.error) {
    throw new ApiError(
      "تعذر جلب ساعات الأسبوع.",
      500,
      "DASHBOARD_WEEK_HOURS_FAILED",
    );
  }

  let inProgress = 0;
  let completed = 0;
  let overdue = 0;
  let dueToday = 0;

  for (const row of tasksRes.data ?? []) {
    const status = row.status as string;
    const dueDate = (row.due_date as string | null) ?? null;
    if (status === "in_progress") inProgress += 1;
    if (status === "completed") completed += 1;
    if (status !== "completed" && dueDate && dueDate < today) overdue += 1;
    if (status !== "completed" && dueDate === today) dueToday += 1;
  }

  let weekHours = 0;
  for (const row of weekAttRes.data ?? []) {
    const hours = Number(row.total_hours ?? 0);
    if (Number.isFinite(hours)) weekHours += hours;
  }

  return {
    inProgress,
    completed,
    overdue,
    weekHours: Math.round(weekHours * 100) / 100,
    dueToday,
  };
}

async function listTodayTasks(
  userId: string,
  today: string,
): Promise<DashboardTaskItem[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tasks")
    .select("id, title, status, due_date, project:projects!project_id(id, name)")
    .eq("assigned_to", userId)
    .eq("due_date", today)
    .is("parent_task_id", null)
    .order("status", { ascending: true })
    .limit(50);

  if (error) {
    throw new ApiError(
      "تعذر جلب مهام اليوم.",
      500,
      "DASHBOARD_TODAY_TASKS_FAILED",
    );
  }

  return (data ?? []).map(mapTaskRow);
}

async function listWeekAttendance(
  userId: string,
  today: string,
): Promise<DashboardAttendanceItem[]> {
  const { start, end } = currentWeekBounds(today);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("attendance_records")
    .select(
      "id, date, clock_in, clock_out, total_hours, status",
    )
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });

  if (error) {
    throw new ApiError(
      "تعذر جلب سجل الأسبوع.",
      500,
      "DASHBOARD_WEEK_ATTENDANCE_FAILED",
    );
  }

  return (data ?? []).map((row) => {
    const status = row.status as AttendanceStatus;
    const clockOut = (row.clock_out as string | null) ?? null;
    const totalHours =
      row.total_hours === null || row.total_hours === undefined
        ? null
        : Number(row.total_hours);
    return {
      id: row.id as string,
      date: row.date as string,
      clockIn: row.clock_in as string,
      clockOut,
      totalHours,
      status,
      uiState: deriveAttendanceUiState(status, clockOut),
    };
  });
}

async function getAdminDashboard(): Promise<AdminDashboard> {
  const admin = createAdminClient();

  const [deptRes, projRes, usersRes, pending, allUsers] = await Promise.all([
    admin
      .from("departments")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    admin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .neq("employee_number", SYSTEM_ADMIN_EMPLOYEE_NUMBER),
    countPendingApprovals(null),
    admin
      .from("users")
      .select("id")
      .eq("is_active", true)
      .neq("employee_number", SYSTEM_ADMIN_EMPLOYEE_NUMBER),
  ]);

  if (deptRes.error || projRes.error || usersRes.error || allUsers.error) {
    throw new ApiError(
      "تعذر جلب لوحة التحكم.",
      500,
      "DASHBOARD_ADMIN_FAILED",
    );
  }

  const userIds = (allUsers.data ?? []).map((u) => u.id as string);
  const companyWorkload = await buildWorkload(userIds);

  return {
    role: "admin",
    departmentsCount: deptRes.count ?? 0,
    activeProjectsCount: projRes.count ?? 0,
    employeesCount: usersRes.count ?? 0,
    pendingApprovals: pending,
    companyWorkload,
  };
}

async function getManagerDashboard(
  viewer: AppUser,
): Promise<ManagerDashboard> {
  const managedDepartmentId = await getManagedDepartmentId(viewer.id);
  if (!managedDepartmentId) {
    return {
      role: "department_manager",
      managedDepartmentId: null,
      departmentProjects: [],
      overdueTasks: [],
      teamWorkload: [],
      pendingApprovals: emptyPending(),
    };
  }

  const today = calendarDateInOrgTimezone(new Date(), ATTENDANCE_TIMEZONE);
  const memberIds = await listDepartmentMemberIds(managedDepartmentId);
  const departmentProjects = await listDepartmentProjects(managedDepartmentId);

  const admin = createAdminClient();
  const { data: projectRows, error: projectError } = await admin
    .from("projects")
    .select("id")
    .eq("department_id", managedDepartmentId)
    .neq("status", "archived");

  if (projectError) {
    throw new ApiError(
      "تعذر جلب مشاريع القسم.",
      500,
      "DASHBOARD_PROJECTS_FAILED",
    );
  }

  const projectIds = (projectRows ?? []).map((p) => p.id as string);
  const [overdueTasks, teamWorkload, pendingApprovals] = await Promise.all([
    listOverdueTasks(projectIds, today),
    buildWorkload(memberIds),
    countPendingApprovals(memberIds),
  ]);

  return {
    role: "department_manager",
    managedDepartmentId,
    departmentProjects,
    overdueTasks,
    teamWorkload,
    pendingApprovals,
  };
}

async function getEmployeeDashboard(
  viewer: AppUser,
): Promise<EmployeeDashboard> {
  const today = calendarDateInOrgTimezone(new Date(), ATTENDANCE_TIMEZONE);
  const [metrics, todayTasks, weekAttendance, attendanceSummary, myRequests] =
    await Promise.all([
      getEmployeeMetrics(viewer.id, today),
      listTodayTasks(viewer.id, today),
      listWeekAttendance(viewer.id, today),
      getAttendanceSummary(viewer.id, today),
      listMyRequests(viewer.id),
    ]);

  return {
    role: "employee",
    today,
    metrics,
    todayTasks,
    weekAttendance,
    attendanceSummary,
    myRequests,
  };
}

export async function getDashboardSummary(
  viewer: AppUser,
): Promise<DashboardSummary> {
  if (viewer.role === "admin") {
    return getAdminDashboard();
  }
  if (viewer.role === "department_manager") {
    return getManagerDashboard(viewer);
  }
  return getEmployeeDashboard(viewer);
}

export { addCalendarDays, currentMonthBounds, currentWeekBounds };
