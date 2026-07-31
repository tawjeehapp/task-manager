import "server-only";

import { calendarDateInOrgTimezone } from "@/features/attendance/services/compute-hours";
import {
  ATTENDANCE_TIMEZONE,
  deriveAttendanceUiState,
  type AttendanceStatus,
} from "@/features/attendance/types/attendance.types";
import { getManagedDepartmentId } from "@/features/departments/services/membership-helpers";
import {
  DASHBOARD_LIST_LIMIT,
  type AdminDashboard,
  type DashboardAttendanceItem,
  type DashboardAttendanceSummary,
  type DashboardRequestItem,
  type DashboardSummary,
  type DashboardTaskItem,
  type EmployeeDashboard,
  type EmployeeDashboardMetrics,
  type LeadershipDashboardBase,
  type ManagerDashboard,
  type PendingApprovalsBreakdown,
} from "@/features/dashboard/types/dashboard.types";
import {
  calendarDateOnly,
  isIncludedInTodayList,
  sortTodayListTasks,
} from "@/features/dashboard/lib/actionable-tasks";
import { aggregateLeadershipFromRows } from "@/features/dashboard/services/leadership-aggregates";
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

function emptyLeadershipBase(today: string): LeadershipDashboardBase {
  return {
    today,
    metrics: {
      activeProjectsCount: 0,
      avgProgressPercent: 0,
      inProgressCount: 0,
      overdueCount: 0,
      weekHours: 0,
    },
    attention: {
      overduePeople: [],
      pendingApprovals: emptyPending(),
      missingAttendanceToday: [],
    },
    team: [],
    projects: [],
  };
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

async function buildLeadershipDashboard(input: {
  userIds: string[];
  projectIds: string[];
  today: string;
  pendingUserIds: string[] | null;
}): Promise<LeadershipDashboardBase> {
  const { userIds, projectIds, today, pendingUserIds } = input;
  const { start: weekStart, end: weekEnd } = currentWeekBounds(today);

  if (userIds.length === 0 && projectIds.length === 0) {
    const pending = await countPendingApprovals(pendingUserIds);
    const base = emptyLeadershipBase(today);
    return {
      ...base,
      attention: { ...base.attention, pendingApprovals: pending },
    };
  }

  const admin = createAdminClient();

  const usersPromise =
    userIds.length === 0
      ? Promise.resolve({ data: [] as unknown[], error: null })
      : admin
          .from("users")
          .select("id, full_name, employee_number, avatar_url")
          .in("id", userIds)
          .eq("is_active", true)
          .neq("employee_number", SYSTEM_ADMIN_EMPLOYEE_NUMBER);

  const projectsPromise =
    projectIds.length === 0
      ? Promise.resolve({ data: [] as unknown[], error: null })
      : admin
          .from("projects")
          .select(
            "id, name, status, department:departments!department_id(id, name)",
          )
          .in("id", projectIds);

  const tasksPromise =
    projectIds.length === 0
      ? Promise.resolve({ data: [] as unknown[], error: null })
      : admin
          .from("tasks")
          .select(
            "id, project_id, assigned_to, status, due_date, estimated_hours, progress_percentage, parent_task_id",
          )
          .in("project_id", projectIds);

  const attendancePromise =
    userIds.length === 0
      ? Promise.resolve({ data: [] as unknown[], error: null })
      : admin
          .from("attendance_records")
          .select("user_id, date, clock_out, total_hours")
          .in("user_id", userIds)
          .gte("date", weekStart)
          .lte("date", weekEnd);

  const [usersRes, projectsRes, tasksRes, attendanceRes, membershipsRes, pending] =
    await Promise.all([
      usersPromise,
      projectsPromise,
      tasksPromise,
      attendancePromise,
      userIds.length === 0
        ? Promise.resolve({ data: [] as unknown[], error: null })
        : admin
            .from("department_memberships")
            .select(
              "user_id, department_id, department:departments!department_id(id, name)",
            )
            .in("user_id", userIds)
            .eq("is_current", true),
      countPendingApprovals(pendingUserIds),
    ]);

  if (
    usersRes.error ||
    projectsRes.error ||
    tasksRes.error ||
    attendanceRes.error ||
    membershipsRes.error
  ) {
    throw new ApiError(
      "تعذر جلب لوحة القيادة.",
      500,
      "DASHBOARD_LEADERSHIP_FAILED",
    );
  }

  const departmentByUser = new Map<
    string,
    { departmentId: string; departmentName: string }
  >();
  for (const row of membershipsRes.data ?? []) {
    const r = row as {
      user_id: string;
      department_id: string;
      department:
        | { id: string; name: string }
        | { id: string; name: string }[]
        | null;
    };
    if (departmentByUser.has(r.user_id)) continue;
    const department = Array.isArray(r.department)
      ? r.department[0]
      : r.department;
    departmentByUser.set(r.user_id, {
      departmentId: r.department_id,
      departmentName: department?.name ?? "",
    });
  }

  const users = (usersRes.data ?? []).map((row) => {
    const r = row as {
      id: string;
      full_name: string;
      employee_number: string;
      avatar_url: string | null;
    };
    const dept = departmentByUser.get(r.id);
    return {
      userId: r.id,
      fullName: r.full_name,
      employeeNumber: r.employee_number,
      avatarUrl: r.avatar_url,
      departmentId: dept?.departmentId ?? null,
      departmentName: dept?.departmentName || null,
    };
  });

  const projects = (projectsRes.data ?? []).map((row) => {
    const r = row as {
      id: string;
      name: string;
      status: string;
      department:
        | { id: string; name: string }
        | { id: string; name: string }[]
        | null;
    };
    const department = Array.isArray(r.department)
      ? r.department[0]
      : r.department;
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      departmentId: department?.id ?? null,
      departmentName: department?.name ?? null,
    };
  });

  const tasks = (tasksRes.data ?? []).map((row) => {
    const r = row as {
      id: string;
      project_id: string;
      assigned_to: string | null;
      status: string;
      due_date: string | null;
      estimated_hours: number | string | null;
      progress_percentage: number;
      parent_task_id: string | null;
    };
    return {
      id: r.id,
      projectId: r.project_id,
      assignedTo: r.assigned_to,
      status: r.status,
      dueDate: r.due_date,
      estimatedHours:
        r.estimated_hours === null || r.estimated_hours === undefined
          ? null
          : Number(r.estimated_hours),
      progressPercentage: Number(r.progress_percentage ?? 0),
      parentTaskId: r.parent_task_id,
    };
  });

  const attendance = (attendanceRes.data ?? []).map((row) => {
    const r = row as {
      user_id: string;
      date: string;
      clock_out: string | null;
      total_hours: number | string | null;
    };
    return {
      userId: r.user_id,
      date: r.date,
      clockOut: r.clock_out,
      totalHours:
        r.total_hours === null || r.total_hours === undefined
          ? null
          : Number(r.total_hours),
    };
  });

  const aggregated = aggregateLeadershipFromRows({
    today,
    weekStart,
    weekEnd,
    users,
    projects,
    tasks,
    attendance,
  });

  return {
    today,
    metrics: aggregated.metrics,
    attention: {
      overduePeople: aggregated.overduePeople,
      pendingApprovals: pending,
      missingAttendanceToday: aggregated.missingAttendanceToday,
    },
    team: aggregated.team,
    projects: aggregated.projects,
  };
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
  priority: unknown;
  parent_task_id: unknown;
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
    dueDate: calendarDateOnly(row.due_date as string | null),
    priority: row.priority as string,
    parentTaskId: (row.parent_task_id as string | null) ?? null,
    projectName,
    href: `/tasks/${row.id}`,
    incompleteDependencyCount: 0,
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
      .select("id, status, due_date, parent_task_id")
      .eq("assigned_to", userId),
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

  let todo = 0;
  let inProgress = 0;
  let blocked = 0;
  let completed = 0;
  let overdue = 0;
  let dueToday = 0;

  for (const row of tasksRes.data ?? []) {
    const status = row.status as string;
    const dueDate = (row.due_date as string | null) ?? null;
    if (status === "todo") todo += 1;
    if (status === "in_progress") inProgress += 1;
    if (status === "blocked") blocked += 1;
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
    todo,
    inProgress,
    blocked,
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
    .select(
      "id, title, status, due_date, priority, parent_task_id, project:projects!project_id(id, name)",
    )
    .eq("assigned_to", userId)
    .lte("due_date", today)
    .not("due_date", "is", null)
    .order("due_date", { ascending: true })
    .limit(100);

  if (error) {
    throw new ApiError(
      "تعذر جلب مهام اليوم.",
      500,
      "DASHBOARD_TODAY_TASKS_FAILED",
    );
  }

  const items = (data ?? [])
    .map(mapTaskRow)
    .filter((task) => isIncludedInTodayList(task, today));

  return sortTodayListTasks(items, today).slice(0, 50);
}

async function listWeekAttendance(
  userId: string,
  today: string,
): Promise<DashboardAttendanceItem[]> {
  const { start, end } = currentWeekBounds(today);
  const admin = createAdminClient();
  const [attendanceRes, workLogsRes] = await Promise.all([
    admin
      .from("attendance_records")
      .select("id, date, clock_in, clock_out, total_hours, status")
      .eq("user_id", userId)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false }),
    admin
      .from("work_logs")
      .select("date, hours, task_id, description, task:tasks!task_id(id, title)")
      .eq("user_id", userId)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true }),
  ]);

  if (attendanceRes.error) {
    throw new ApiError(
      "تعذر جلب سجل الأسبوع.",
      500,
      "DASHBOARD_WEEK_ATTENDANCE_FAILED",
    );
  }

  const allocationsByDate = new Map<
    string,
    {
      kind: "task" | "general";
      taskId: string | null;
      title: string;
      hours: number;
      reason: string | null;
    }[]
  >();

  if (!workLogsRes.error) {
    for (const row of workLogsRes.data ?? []) {
      const date = row.date as string;
      const task = row.task as
        | { id: string; title: string }
        | { id: string; title: string }[]
        | null;
      const taskObj = Array.isArray(task) ? (task[0] ?? null) : task;
      const taskId = (row.task_id as string | null) ?? taskObj?.id ?? null;
      const list = allocationsByDate.get(date) ?? [];
      if (taskId) {
        list.push({
          kind: "task",
          taskId,
          title: taskObj?.title ?? "—",
          hours: Number(row.hours),
          reason: null,
        });
      } else {
        list.push({
          kind: "general",
          taskId: null,
          title: "",
          hours: Number(row.hours),
          reason: (row.description as string | null) ?? null,
        });
      }
      allocationsByDate.set(date, list);
    }
  }

  return (attendanceRes.data ?? []).map((row) => {
    const status = row.status as AttendanceStatus;
    const clockOut = (row.clock_out as string | null) ?? null;
    const totalHours =
      row.total_hours === null || row.total_hours === undefined
        ? null
        : Number(row.total_hours);
    const date = row.date as string;
    return {
      id: row.id as string,
      date,
      clockIn: row.clock_in as string,
      clockOut,
      totalHours,
      status,
      uiState: deriveAttendanceUiState(status, clockOut),
      allocations: allocationsByDate.get(date) ?? [],
    };
  });
}

async function getAdminDashboard(): Promise<AdminDashboard> {
  const today = calendarDateInOrgTimezone(new Date(), ATTENDANCE_TIMEZONE);
  const admin = createAdminClient();

  const [usersRes, projectsRes] = await Promise.all([
    admin
      .from("users")
      .select("id")
      .eq("is_active", true)
      .neq("employee_number", SYSTEM_ADMIN_EMPLOYEE_NUMBER),
    admin.from("projects").select("id").neq("status", "archived"),
  ]);

  if (usersRes.error || projectsRes.error) {
    throw new ApiError(
      "تعذر جلب لوحة التحكم.",
      500,
      "DASHBOARD_ADMIN_FAILED",
    );
  }

  const userIds = (usersRes.data ?? []).map((u) => u.id as string);
  const projectIds = (projectsRes.data ?? []).map((p) => p.id as string);
  const leadership = await buildLeadershipDashboard({
    userIds,
    projectIds,
    today,
    pendingUserIds: null,
  });

  return {
    role: "admin",
    ...leadership,
  };
}

async function getManagerDashboard(
  viewer: AppUser,
): Promise<ManagerDashboard> {
  const today = calendarDateInOrgTimezone(new Date(), ATTENDANCE_TIMEZONE);
  const managedDepartmentId = await getManagedDepartmentId(viewer.id);
  if (!managedDepartmentId) {
    return {
      role: "department_manager",
      managedDepartmentId: null,
      ...emptyLeadershipBase(today),
    };
  }

  const memberIds = await listDepartmentMemberIds(managedDepartmentId);
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
  const leadership = await buildLeadershipDashboard({
    userIds: memberIds,
    projectIds,
    today,
    pendingUserIds: memberIds,
  });

  return {
    role: "department_manager",
    managedDepartmentId,
    ...leadership,
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
