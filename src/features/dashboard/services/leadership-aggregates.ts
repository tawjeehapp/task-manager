import type {
  LeadershipProjectHealth,
  LeadershipProjectRow,
  LeadershipTeamRow,
  LeadershipTodayStatus,
  LeadershipMetrics,
  LeadershipOverduePerson,
  LeadershipPersonRef,
} from "@/features/dashboard/types/dashboard.types";
import { ATTENTION_OVERDUE_PEOPLE_LIMIT } from "@/features/dashboard/types/dashboard.types";
import { ACTIVE_TASK_STATUSES } from "@/features/tasks/types/task.types";
import { computeHoursWeightedProgress } from "@/features/projects/lib/project-progress";
import {
  computeAvailableHours,
  computeCapacityLoad,
  computeCapacityPercent,
  countApprovedLeaveDaysInRange,
} from "@/features/tasks/services/capacity";

export type AggregateTaskRow = {
  id: string;
  projectId: string;
  assignedTo: string | null;
  status: string;
  dueDate: string | null;
  estimatedHours: number;
};

export type AggregateAttendanceRow = {
  userId: string;
  date: string;
  clockOut: string | null;
  totalHours: number | null;
  status: string;
};

export type AggregateUserMeta = {
  userId: string;
  fullName: string;
  employeeNumber: string;
  avatarUrl: string | null;
  departmentId: string | null;
  departmentName: string | null;
  weeklyCapacityHours: number;
};

export type AggregateLeaveRow = {
  userId: string;
  startDate: string;
  endDate: string;
};

export type AggregateProjectMeta = {
  id: string;
  name: string;
  departmentId: string | null;
  departmentName: string | null;
  status: string;
};

export function isOverdueTask(
  task: Pick<AggregateTaskRow, "status" | "dueDate">,
  today: string,
): boolean {
  return (
    task.status !== "completed" &&
    task.dueDate != null &&
    task.dueDate < today
  );
}

export function isDueTodayTask(
  task: Pick<AggregateTaskRow, "status" | "dueDate">,
  today: string,
): boolean {
  return task.status !== "completed" && task.dueDate === today;
}

export function isOpenTask(status: string): boolean {
  return (ACTIVE_TASK_STATUSES as readonly string[]).includes(status);
}

export function deriveTodayStatus(
  attendance: { clockOut: string | null } | null | undefined,
): LeadershipTodayStatus {
  if (!attendance) return "missing";
  if (attendance.clockOut == null) return "working";
  return "recorded";
}

export function computeProjectProgress(
  rootTasks: AggregateTaskRow[],
): number {
  return computeHoursWeightedProgress(
    rootTasks.map((task) => ({
      status: task.status,
      estimatedHours: task.estimatedHours,
    })),
  );
}

export function computeProjectHealth(
  tasks: AggregateTaskRow[],
  today: string,
): LeadershipProjectHealth {
  return tasks.some((task) => isOverdueTask(task, today))
    ? "overdue"
    : "on_track";
}

export function nearestOpenDueDate(
  tasks: AggregateTaskRow[],
): string | null {
  let nearest: string | null = null;
  for (const task of tasks) {
    if (task.status === "completed" || !task.dueDate) continue;
    if (nearest == null || task.dueDate < nearest) {
      nearest = task.dueDate;
    }
  }
  return nearest;
}

export function aggregateLeadershipFromRows(input: {
  today: string;
  weekStart: string;
  weekEnd: string;
  users: AggregateUserMeta[];
  projects: AggregateProjectMeta[];
  tasks: AggregateTaskRow[];
  attendance: AggregateAttendanceRow[];
  approvedLeave?: AggregateLeaveRow[];
}): {
  metrics: LeadershipMetrics;
  overduePeople: LeadershipOverduePerson[];
  missingAttendanceToday: LeadershipPersonRef[];
  team: LeadershipTeamRow[];
  projects: LeadershipProjectRow[];
} {
  const {
    today,
    weekStart,
    weekEnd,
    users,
    projects,
    tasks,
    attendance,
    approvedLeave = [],
  } = input;

  const tasksByProject = new Map<string, AggregateTaskRow[]>();
  for (const task of tasks) {
    const list = tasksByProject.get(task.projectId) ?? [];
    list.push(task);
    tasksByProject.set(task.projectId, list);
  }

  const projectRows: LeadershipProjectRow[] = projects.map((project) => {
    const all = tasksByProject.get(project.id) ?? [];
    const progressPercent = computeProjectProgress(all);
    const todoCount = all.filter((t) => t.status === "todo").length;
    const inProgressCount = all.filter((t) => t.status === "in_progress").length;
    const blockedCount = all.filter((t) => t.status === "blocked").length;
    const completedCount = all.filter((t) => t.status === "completed").length;
    const overdueCount = all.filter((t) => isOverdueTask(t, today)).length;
    const dueTodayCount = all.filter((t) => isDueTodayTask(t, today)).length;
    return {
      id: project.id,
      name: project.name,
      departmentId: project.departmentId,
      departmentName: project.departmentName,
      progressPercent,
      todoCount,
      inProgressCount,
      blockedCount,
      completedCount,
      overdueCount,
      dueTodayCount,
      nearestDueDate: nearestOpenDueDate(all),
      health: computeProjectHealth(all, today),
      href: `/projects/${project.id}`,
    };
  });

  projectRows.sort((a, b) => {
    if (a.health !== b.health) {
      return a.health === "overdue" ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "ar");
  });

  const activeProjects = projects.filter((p) => p.status === "active");
  const activeProjectRows = projectRows.filter((p) =>
    activeProjects.some((ap) => ap.id === p.id),
  );
  const avgProgressPercent =
    activeProjectRows.length === 0
      ? 0
      : Math.round(
          (activeProjectRows.reduce((s, p) => s + p.progressPercent, 0) /
            activeProjectRows.length) *
            10,
        ) / 10;

  let todoCount = 0;
  let inProgressCount = 0;
  let blockedCount = 0;
  let completedCount = 0;
  let overdueCount = 0;
  let dueTodayCount = 0;
  const todoTiming = { overdue: 0, dueToday: 0 };
  const inProgressTiming = { overdue: 0, dueToday: 0 };
  const blockedTiming = { overdue: 0, dueToday: 0 };
  const completedTiming = { overdue: 0, dueToday: 0 };

  for (const task of tasks) {
    const overdue = isOverdueTask(task, today);
    const dueToday = isDueTodayTask(task, today);
    if (task.status === "todo") {
      todoCount += 1;
      if (overdue) todoTiming.overdue += 1;
      if (dueToday) todoTiming.dueToday += 1;
    } else if (task.status === "in_progress") {
      inProgressCount += 1;
      if (overdue) inProgressTiming.overdue += 1;
      if (dueToday) inProgressTiming.dueToday += 1;
    } else if (task.status === "blocked") {
      blockedCount += 1;
      if (overdue) blockedTiming.overdue += 1;
      if (dueToday) blockedTiming.dueToday += 1;
    } else if (task.status === "completed") {
      completedCount += 1;
    }
    if (overdue) overdueCount += 1;
    if (dueToday) dueTodayCount += 1;
  }

  const weekHoursByUser = new Map<
    string,
    { total: number; approved: number; pending: number; rejected: number }
  >();
  const todayAttendanceByUser = new Map<
    string,
    { clockOut: string | null }
  >();
  let weekHoursApproved = 0;
  let weekHoursPending = 0;
  let weekHoursRejected = 0;
  for (const row of attendance) {
    if (row.date >= weekStart && row.date <= weekEnd) {
      const hours = row.totalHours ?? 0;
      if (Number.isFinite(hours)) {
        const bucket = weekHoursByUser.get(row.userId) ?? {
          total: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
        };
        bucket.total += hours;
        if (row.status === "approved") {
          weekHoursApproved += hours;
          bucket.approved += hours;
        } else if (row.status === "rejected") {
          weekHoursRejected += hours;
          bucket.rejected += hours;
        } else {
          weekHoursPending += hours;
          bucket.pending += hours;
        }
        weekHoursByUser.set(row.userId, bucket);
      }
    }
    if (row.date === today) {
      todayAttendanceByUser.set(row.userId, { clockOut: row.clockOut });
    }
  }

  const overdueByAssignee = new Map<string, number>();
  const tasksByAssignee = new Map<string, AggregateTaskRow[]>();
  for (const task of tasks) {
    if (!task.assignedTo) continue;
    const list = tasksByAssignee.get(task.assignedTo) ?? [];
    list.push(task);
    tasksByAssignee.set(task.assignedTo, list);
    if (isOverdueTask(task, today)) {
      overdueByAssignee.set(
        task.assignedTo,
        (overdueByAssignee.get(task.assignedTo) ?? 0) + 1,
      );
    }
  }

  const userName = new Map(users.map((u) => [u.userId, u.fullName]));
  const overduePeople: LeadershipOverduePerson[] = [...overdueByAssignee.entries()]
    .map(([userId, count]) => ({
      userId,
      fullName: userName.get(userId) ?? userId,
      overdueCount: count,
    }))
    .sort((a, b) => b.overdueCount - a.overdueCount)
    .slice(0, ATTENTION_OVERDUE_PEOPLE_LIMIT);

  const missingAttendanceToday: LeadershipPersonRef[] = users
    .filter((u) => !todayAttendanceByUser.has(u.userId))
    .map((u) => ({ userId: u.userId, fullName: u.fullName }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"));

  const leaveByUser = new Map<string, AggregateLeaveRow[]>();
  for (const leave of approvedLeave) {
    const list = leaveByUser.get(leave.userId) ?? [];
    list.push(leave);
    leaveByUser.set(leave.userId, list);
  }

  const team: LeadershipTeamRow[] = users.map((user) => {
    const assigned = tasksByAssignee.get(user.userId) ?? [];
    const openTaskCount = assigned.filter((t) => isOpenTask(t.status)).length;
    const todo = assigned.filter((t) => t.status === "todo").length;
    const inProgress = assigned.filter((t) => t.status === "in_progress").length;
    const blocked = assigned.filter((t) => t.status === "blocked").length;
    const completed = assigned.filter((t) => t.status === "completed").length;
    const overdue = assigned.filter((t) => isOverdueTask(t, today)).length;
    const dueToday = assigned.filter((t) => isDueTodayTask(t, today)).length;
    const hours = weekHoursByUser.get(user.userId);
    const load = computeCapacityLoad(assigned);
    const leaveDaysInWeek = countApprovedLeaveDaysInRange(
      weekStart,
      weekEnd,
      leaveByUser.get(user.userId) ?? [],
    );
    const availableHours = computeAvailableHours(
      user.weeklyCapacityHours,
      leaveDaysInWeek,
    );
    const capacityPercent = computeCapacityPercent(
      load.estimatedHours,
      availableHours,
    );
    return {
      userId: user.userId,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      employeeNumber: user.employeeNumber,
      departmentId: user.departmentId,
      departmentName: user.departmentName,
      openTaskCount,
      todoCount: todo,
      inProgressCount: inProgress,
      blockedCount: blocked,
      completedCount: completed,
      overdueCount: overdue,
      dueTodayCount: dueToday,
      loadHours: load.estimatedHours,
      availableHours,
      capacityPercent,
      weekHours: Math.round((hours?.total ?? 0) * 100) / 100,
      weekHoursApproved: Math.round((hours?.approved ?? 0) * 100) / 100,
      weekHoursPending: Math.round((hours?.pending ?? 0) * 100) / 100,
      weekHoursRejected: Math.round((hours?.rejected ?? 0) * 100) / 100,
      todayStatus: deriveTodayStatus(todayAttendanceByUser.get(user.userId)),
      href: `/employees/${user.userId}`,
    };
  });

  team.sort((a, b) => {
    if (b.capacityPercent !== a.capacityPercent) {
      return b.capacityPercent - a.capacityPercent;
    }
    return a.fullName.localeCompare(b.fullName, "ar");
  });

  const metrics: LeadershipMetrics = {
    activeProjectsCount: activeProjects.length,
    avgProgressPercent,
    todoCount,
    inProgressCount,
    blockedCount,
    completedCount,
    overdueCount,
    dueTodayCount,
    todoTiming,
    inProgressTiming,
    blockedTiming,
    completedTiming,
    weekHours:
      Math.round(
        (weekHoursApproved + weekHoursPending + weekHoursRejected) * 100,
      ) / 100,
    weekHoursApproved: Math.round(weekHoursApproved * 100) / 100,
    weekHoursPending: Math.round(weekHoursPending * 100) / 100,
    weekHoursRejected: Math.round(weekHoursRejected * 100) / 100,
  };

  return {
    metrics,
    overduePeople,
    missingAttendanceToday,
    team,
    projects: projectRows,
  };
}
