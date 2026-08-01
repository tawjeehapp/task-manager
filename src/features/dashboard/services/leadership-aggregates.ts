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

export type AggregateTaskRow = {
  id: string;
  projectId: string;
  assignedTo: string | null;
  status: string;
  dueDate: string | null;
  estimatedHours: number | null;
  progressPercentage: number;
};

export type AggregateAttendanceRow = {
  userId: string;
  date: string;
  clockOut: string | null;
  totalHours: number | null;
};

export type AggregateUserMeta = {
  userId: string;
  fullName: string;
  employeeNumber: string;
  avatarUrl: string | null;
  departmentId: string | null;
  departmentName: string | null;
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
  if (rootTasks.length === 0) return 0;
  const sum = rootTasks.reduce(
    (acc, task) => acc + (Number.isFinite(task.progressPercentage) ? task.progressPercentage : 0),
    0,
  );
  return Math.round((sum / rootTasks.length) * 10) / 10;
}

export function computeProjectEstimatedHours(
  rootTasks: AggregateTaskRow[],
): number {
  let sum = 0;
  for (const task of rootTasks) {
    if (task.estimatedHours != null && Number.isFinite(task.estimatedHours)) {
      sum += task.estimatedHours;
    }
  }
  return Math.round(sum * 100) / 100;
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
    const overdueCount = all.filter((t) => isOverdueTask(t, today)).length;
    const inProgressCount = all.filter((t) => t.status === "in_progress").length;
    return {
      id: project.id,
      name: project.name,
      departmentId: project.departmentId,
      departmentName: project.departmentName,
      progressPercent,
      inProgressCount,
      overdueCount,
      estimatedHoursSum: computeProjectEstimatedHours(all),
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

  let inProgressCount = 0;
  let overdueCount = 0;
  for (const task of tasks) {
    if (task.status === "in_progress") inProgressCount += 1;
    if (isOverdueTask(task, today)) overdueCount += 1;
  }

  const weekHoursByUser = new Map<string, number>();
  const todayAttendanceByUser = new Map<
    string,
    { clockOut: string | null }
  >();
  let weekHoursTotal = 0;
  for (const row of attendance) {
    if (row.date >= weekStart && row.date <= weekEnd) {
      const hours = row.totalHours ?? 0;
      if (Number.isFinite(hours)) {
        weekHoursTotal += hours;
        weekHoursByUser.set(
          row.userId,
          (weekHoursByUser.get(row.userId) ?? 0) + hours,
        );
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

  const team: LeadershipTeamRow[] = users.map((user) => {
    const assigned = tasksByAssignee.get(user.userId) ?? [];
    const openTaskCount = assigned.filter((t) => isOpenTask(t.status)).length;
    const inProgress = assigned.filter((t) => t.status === "in_progress").length;
    const overdue = assigned.filter((t) => isOverdueTask(t, today)).length;
    const dueToday = assigned.filter(
      (t) => t.status !== "completed" && t.dueDate === today,
    ).length;
    return {
      userId: user.userId,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      employeeNumber: user.employeeNumber,
      departmentId: user.departmentId,
      departmentName: user.departmentName,
      openTaskCount,
      inProgressCount: inProgress,
      overdueCount: overdue,
      dueTodayCount: dueToday,
      weekHours:
        Math.round((weekHoursByUser.get(user.userId) ?? 0) * 100) / 100,
      todayStatus: deriveTodayStatus(todayAttendanceByUser.get(user.userId)),
      href: `/employees/${user.userId}`,
    };
  });

  team.sort((a, b) => {
    if (b.openTaskCount !== a.openTaskCount) {
      return b.openTaskCount - a.openTaskCount;
    }
    return a.fullName.localeCompare(b.fullName, "ar");
  });

  const metrics: LeadershipMetrics = {
    activeProjectsCount: activeProjects.length,
    avgProgressPercent,
    inProgressCount,
    overdueCount,
    weekHours: Math.round(weekHoursTotal * 100) / 100,
  };

  return {
    metrics,
    overduePeople,
    missingAttendanceToday,
    team,
    projects: projectRows,
  };
}
