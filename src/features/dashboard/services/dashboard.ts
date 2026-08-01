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
  type DashboardRejectedLeaveItem,
  type DashboardRequestItem,
  type DashboardSummary,
  type DashboardTaskItem,
  type EmployeeDashboard,
  type EmployeeDashboardMetrics,
  type LeadershipDashboardBase,
  type LeadershipDepartmentRow,
  type ManagerDashboard,
  type PendingApprovalsBreakdown,
} from "@/features/dashboard/types/dashboard.types";
import {
  calendarDateOnly,
  countEmployeeTaskMetrics,
  isIncludedInTodayList,
  sortOpenListTasks,
  sortTodayListTasks,
} from "@/features/dashboard/lib/actionable-tasks";
import {
  aggregateDepartmentRows,
  aggregateLeadershipFromRows,
  type AggregateDepartmentMeta,
} from "@/features/dashboard/services/leadership-aggregates";
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
  return {
    leave: 0,
    extension: 0,
    excusal: 0,
    attendance: 0,
    projectExtension: 0,
    total: 0,
  };
}

function emptyLeadershipBase(today: string): LeadershipDashboardBase {
  return {
    today,
    metrics: {
      activeProjectsCount: 0,
      avgProgressPercent: 0,
      todoCount: 0,
      inProgressCount: 0,
      blockedCount: 0,
      completedCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      todoTiming: { overdue: 0, dueToday: 0 },
      inProgressTiming: { overdue: 0, dueToday: 0 },
      blockedTiming: { overdue: 0, dueToday: 0 },
      completedTiming: { overdue: 0, dueToday: 0 },
      weekHours: 0,
      weekHoursApproved: 0,
      weekHoursPending: 0,
      weekHoursRejected: 0,
    },
    attention: {
      overduePeople: [],
      lateProjects: [],
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

  // Project due-date extensions are admin-approved (org-wide when userIds is null).
  if (userIds === null) {
    const projectExt = await admin
      .from("project_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("type", "extension");
    if (projectExt.error) {
      throw new ApiError(
        "تعذر جلب الاعتمادات المعلقة.",
        500,
        "DASHBOARD_PENDING_FAILED",
      );
    }
    result.projectExtension = projectExt.count ?? 0;
  }

  result.total =
    result.leave +
    result.extension +
    result.excusal +
    result.attendance +
    result.projectExtension;
  return result;
}

async function buildLeadershipDashboard(input: {
  userIds: string[];
  projectIds: string[];
  today: string;
  pendingUserIds: string[] | null;
  departments?: AggregateDepartmentMeta[];
}): Promise<
  LeadershipDashboardBase & { departments?: LeadershipDepartmentRow[] }
> {
  const { userIds, projectIds, today, pendingUserIds, departments } = input;
  const { start: weekStart, end: weekEnd } = currentWeekBounds(today);

  if (userIds.length === 0 && projectIds.length === 0) {
    const pending = await countPendingApprovals(pendingUserIds);
    const base = emptyLeadershipBase(today);
    return {
      ...base,
      attention: { ...base.attention, pendingApprovals: pending },
      ...(departments
        ? {
            departments: aggregateDepartmentRows({
              today,
              departments,
              users: [],
              projects: [],
              tasks: [],
            }),
          }
        : {}),
    };
  }

  const admin = createAdminClient();

  const usersPromise =
    userIds.length === 0
      ? Promise.resolve({ data: [] as unknown[], error: null })
      : admin
          .from("users")
          .select("id, full_name, employee_number, avatar_url, role, weekly_capacity_hours")
          .in("id", userIds)
          .eq("is_active", true)
          .neq("employee_number", SYSTEM_ADMIN_EMPLOYEE_NUMBER);

  const projectsPromise =
    projectIds.length === 0
      ? Promise.resolve({ data: [] as unknown[], error: null })
      : admin
          .from("projects")
          .select(
            "id, name, status, end_date, department:departments!department_id(id, name)",
          )
          .in("id", projectIds);

  const tasksPromise =
    projectIds.length === 0
      ? Promise.resolve({ data: [] as unknown[], error: null })
      : admin
          .from("tasks")
          .select(
            "id, project_id, assigned_to, status, due_date, estimated_hours",
          )
          .in("project_id", projectIds);

  const attendancePromise =
    userIds.length === 0
      ? Promise.resolve({ data: [] as unknown[], error: null })
      : admin
          .from("attendance_records")
          .select("user_id, date, clock_out, total_hours, status")
          .in("user_id", userIds)
          .gte("date", weekStart)
          .lte("date", weekEnd);

  const leavePromise =
    userIds.length === 0
      ? Promise.resolve({ data: [] as unknown[], error: null })
      : admin
          .from("leave_requests")
          .select("user_id, start_date, end_date")
          .in("user_id", userIds)
          .eq("status", "approved")
          .lte("start_date", weekEnd)
          .gte("end_date", weekStart);

  const [
    usersRes,
    projectsRes,
    tasksRes,
    attendanceRes,
    leaveRes,
    membershipsRes,
    pending,
  ] = await Promise.all([
      usersPromise,
      projectsPromise,
      tasksPromise,
      attendancePromise,
      leavePromise,
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
    leaveRes.error ||
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
      role: "admin" | "department_manager" | "employee";
      weekly_capacity_hours: number | string | null;
    };
    const dept = departmentByUser.get(r.id);
    const rawCapacity = r.weekly_capacity_hours;
    const capacityNum =
      rawCapacity === null || rawCapacity === undefined
        ? 40
        : typeof rawCapacity === "number"
          ? rawCapacity
          : Number(rawCapacity);
    return {
      userId: r.id,
      fullName: r.full_name,
      employeeNumber: r.employee_number,
      avatarUrl: r.avatar_url,
      role: r.role,
      departmentId: dept?.departmentId ?? null,
      departmentName: dept?.departmentName || null,
      weeklyCapacityHours:
        Number.isFinite(capacityNum) && capacityNum > 0 ? capacityNum : 40,
    };
  });

  const projects = (projectsRes.data ?? []).map((row) => {
    const r = row as {
      id: string;
      name: string;
      status: string;
      end_date: string | null;
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
      endDate: r.end_date ?? null,
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
    };
    const hours =
      r.estimated_hours === null || r.estimated_hours === undefined
        ? 1
        : Number(r.estimated_hours);
    return {
      id: r.id,
      projectId: r.project_id,
      assignedTo: r.assigned_to,
      status: r.status,
      dueDate: r.due_date,
      estimatedHours: Number.isFinite(hours) && hours > 0 ? hours : 1,
    };
  });

  const attendance = (attendanceRes.data ?? []).map((row) => {
    const r = row as {
      user_id: string;
      date: string;
      clock_out: string | null;
      total_hours: number | string | null;
      status: string;
    };
    return {
      userId: r.user_id,
      date: r.date,
      clockOut: r.clock_out,
      totalHours:
        r.total_hours === null || r.total_hours === undefined
          ? null
          : Number(r.total_hours),
      status: r.status,
    };
  });

  const approvedLeave = (leaveRes.data ?? []).map((row) => {
    const r = row as {
      user_id: string;
      start_date: string;
      end_date: string;
    };
    return {
      userId: r.user_id,
      startDate: r.start_date,
      endDate: r.end_date,
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
    approvedLeave,
  });

  return {
    today,
    metrics: aggregated.metrics,
    attention: {
      overduePeople: aggregated.overduePeople,
      lateProjects: aggregated.lateProjects,
      pendingApprovals: pending,
      missingAttendanceToday: aggregated.missingAttendanceToday,
    },
    team: aggregated.team,
    projects: aggregated.projects,
    ...(departments
      ? {
          departments: aggregateDepartmentRows({
            today,
            departments,
            users,
            projects,
            tasks,
          }),
        }
      : {}),
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

async function listRejectedLeave(
  userId: string,
): Promise<DashboardRejectedLeaveItem[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("leave_requests")
    .select(
      "id, start_date, end_date, days, rejection_reason, leave_type:leave_types!leave_type_id(name)",
    )
    .eq("user_id", userId)
    .eq("status", "rejected")
    .order("updated_at", { ascending: false })
    .limit(DASHBOARD_LIST_LIMIT);

  if (error) {
    throw new ApiError(
      "تعذر جلب الإجازات المرفوضة.",
      500,
      "DASHBOARD_REJECTED_LEAVE_FAILED",
    );
  }

  return (data ?? []).map((row) => {
    const leaveType = row.leave_type as
      | { name: string }
      | { name: string }[]
      | null;
    const leaveTypeName = Array.isArray(leaveType)
      ? (leaveType[0]?.name ?? "إجازة")
      : (leaveType?.name ?? "إجازة");
    return {
      id: row.id as string,
      leaveTypeName,
      startDate: row.start_date as string,
      endDate: row.end_date as string,
      days: Number(row.days ?? 0),
      rejectionReason: (row.rejection_reason as string | null) ?? null,
      href: "/attendance?tab=leave",
    };
  });
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
    projectName,
    href: `/tasks/${row.id}`,
    incompleteDependencyCount: 0,
  };
}

async function attachIncompleteDependencyCounts(
  items: DashboardTaskItem[],
): Promise<DashboardTaskItem[]> {
  if (items.length === 0) {
    return items;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("task_dependencies")
    .select("task_id, depends_on_task:tasks!depends_on_task_id(status)")
    .in(
      "task_id",
      items.map((item) => item.id),
    );

  if (error) {
    return items;
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const dep = row.depends_on_task as unknown as { status: string } | null;
    if (dep && dep.status !== "completed") {
      const taskId = row.task_id as string;
      counts.set(taskId, (counts.get(taskId) ?? 0) + 1);
    }
  }

  return items.map((item) => ({
    ...item,
    incompleteDependencyCount: counts.get(item.id) ?? 0,
  }));
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
      .eq("assigned_to", userId),
    admin
      .from("attendance_records")
      .select("total_hours, status")
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

  const counts = countEmployeeTaskMetrics(
    (tasksRes.data ?? []).map((row) => ({
      status: row.status as string,
      due_date: (row.due_date as string | null) ?? null,
    })),
    today,
  );

  let weekHoursApproved = 0;
  let weekHoursPending = 0;
  let weekHoursRejected = 0;
  for (const row of weekAttRes.data ?? []) {
    const hours = Number(row.total_hours ?? 0);
    if (!Number.isFinite(hours)) continue;
    const status = row.status as string;
    if (status === "approved") weekHoursApproved += hours;
    else if (status === "rejected") weekHoursRejected += hours;
    else weekHoursPending += hours;
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    ...counts,
    weekHours: round2(
      weekHoursApproved + weekHoursPending + weekHoursRejected,
    ),
    weekHoursApproved: round2(weekHoursApproved),
    weekHoursPending: round2(weekHoursPending),
    weekHoursRejected: round2(weekHoursRejected),
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
      "id, title, status, due_date, priority, project:projects!project_id(id, name)",
    )
    .eq("assigned_to", userId)
    .lte("due_date", today)
    .not("due_date", "is", null)
    .order("due_date", { ascending: true })
    .limit(100);

  if (error) {
    throw new ApiError(
      "تعذر جلب مهام مستحقة اليوم.",
      500,
      "DASHBOARD_TODAY_TASKS_FAILED",
    );
  }

  const items = (data ?? [])
    .map(mapTaskRow)
    .filter((task) => isIncludedInTodayList(task, today));

  return attachIncompleteDependencyCounts(
    sortTodayListTasks(items, today).slice(0, 50),
  );
}

async function listOpenTasks(
  userId: string,
  today: string,
): Promise<DashboardTaskItem[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tasks")
    .select(
      "id, title, status, due_date, priority, project:projects!project_id(id, name)",
    )
    .eq("assigned_to", userId)
    .in("status", ["todo", "in_progress", "blocked"])
    .limit(100);

  if (error) {
    throw new ApiError(
      "تعذر جلب المهام المفتوحة.",
      500,
      "DASHBOARD_OPEN_TASKS_FAILED",
    );
  }

  const items = (data ?? []).map(mapTaskRow);
  return attachIncompleteDependencyCounts(
    sortOpenListTasks(items, today).slice(0, DASHBOARD_LIST_LIMIT),
  );
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
      .select("id, date, clock_in, clock_out, total_hours, status, rejection_reason")
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
      rejectionReason: (row.rejection_reason as string | null) ?? null,
      allocations: allocationsByDate.get(date) ?? [],
    };
  });
}

async function getAdminDashboard(): Promise<AdminDashboard> {
  const today = calendarDateInOrgTimezone(new Date(), ATTENDANCE_TIMEZONE);
  const admin = createAdminClient();

  const [usersRes, projectsRes, departmentsRes] = await Promise.all([
    admin
      .from("users")
      .select("id")
      .eq("is_active", true)
      .neq("employee_number", SYSTEM_ADMIN_EMPLOYEE_NUMBER),
    admin.from("projects").select("id").neq("status", "archived"),
    admin
      .from("departments")
      .select("id, name, manager:users!manager_id(full_name)")
      .eq("status", "active"),
  ]);

  if (usersRes.error || projectsRes.error || departmentsRes.error) {
    throw new ApiError(
      "تعذر جلب لوحة التحكم.",
      500,
      "DASHBOARD_ADMIN_FAILED",
    );
  }

  const userIds = (usersRes.data ?? []).map((u) => u.id as string);
  const projectIds = (projectsRes.data ?? []).map((p) => p.id as string);
  const departments: AggregateDepartmentMeta[] = (departmentsRes.data ?? []).map(
    (row) => {
      const r = row as {
        id: string;
        name: string;
        manager:
          | { full_name: string }
          | { full_name: string }[]
          | null;
      };
      const manager = Array.isArray(r.manager) ? r.manager[0] : r.manager;
      return {
        id: r.id,
        name: r.name,
        managerName: manager?.full_name ?? null,
      };
    },
  );

  const leadership = await buildLeadershipDashboard({
    userIds,
    projectIds,
    today,
    pendingUserIds: null,
    departments,
  });

  return {
    role: "admin",
    ...leadership,
    departments: leadership.departments ?? [],
  };
}

export async function getManagerDashboard(
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

/** Personal employee-style dashboard for any authenticated user (by viewer.id). */
export async function getPersonalDashboard(
  viewer: AppUser,
): Promise<EmployeeDashboard> {
  const today = calendarDateInOrgTimezone(new Date(), ATTENDANCE_TIMEZONE);
  const [
    metrics,
    todayTasks,
    openTasks,
    weekAttendance,
    rejectedLeave,
    attendanceSummary,
    myRequests,
  ] = await Promise.all([
    getEmployeeMetrics(viewer.id, today),
    listTodayTasks(viewer.id, today),
    listOpenTasks(viewer.id, today),
    listWeekAttendance(viewer.id, today),
    listRejectedLeave(viewer.id),
    getAttendanceSummary(viewer.id, today),
    listMyRequests(viewer.id),
  ]);

  return {
    role: "employee",
    today,
    metrics,
    todayTasks,
    openTasks,
    weekAttendance,
    rejectedLeave,
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
  return getPersonalDashboard(viewer);
}

export { addCalendarDays, currentMonthBounds, currentWeekBounds };
