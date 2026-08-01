export type TaskStatus =
  | "todo"
  | "in_progress"
  | "blocked"
  | "completed";

export type TaskPriority = "low" | "medium" | "high";

export type TaskUserSummary = {
  id: string;
  fullName: string;
  employeeNumber: string;
};

export type TaskProjectSummary = {
  id: string;
  name: string;
  departmentId: string;
};

/** Incomplete finish-to-start prerequisite shown on boards. */
export type IncompleteDependencySummary = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  assignee: TaskUserSummary | null;
};

export type Task = {
  id: string;
  projectId: string;
  project: TaskProjectSummary | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: string | null;
  assignee: TaskUserSummary | null;
  createdBy: string;
  createdByUser: TaskUserSummary | null;
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  progressPercentage: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Number of finish-to-start prerequisites. */
  dependencyCount?: number;
  /** Prerequisites that are not yet completed. */
  incompleteDependencyCount?: number;
  /** Titles of incomplete finish-to-start prerequisites. */
  incompleteDependencyTitles?: string[];
  /** Structured incomplete finish-to-start prerequisites. */
  incompleteDependencies?: IncompleteDependencySummary[];
};

export type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string | null;
  created_by: string;
  start_date: string | null;
  due_date: string | null;
  estimated_hours: number | string | null;
  progress_percentage: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "completed",
];

/** Statuses users may set manually; blocked is dependency-driven only. */
export const MANUAL_TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "completed",
];

/** Options for a status control, including blocked only when it is the current value. */
export function selectableTaskStatuses(current: TaskStatus): TaskStatus[] {
  if (current === "blocked") {
    return ["blocked", ...MANUAL_TASK_STATUSES];
  }
  return [...MANUAL_TASK_STATUSES];
}

/** Statuses that count toward employee workload (active work). */
export const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
];

export type TaskDependency = {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  dependsOnTask: {
    id: string;
    title: string;
    status: TaskStatus;
    projectId: string;
  } | null;
  createdAt: string;
};

export type TaskDependencyRow = {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  created_at: string;
};

export type TaskActivityAction =
  | "task.created"
  | "task.assigned"
  | "task.status_changed"
  | "task.updated"
  | "task.dependency_added"
  | "task.dependency_removed";

export type TaskActivityLog = {
  id: string;
  userId: string;
  user: TaskUserSummary | null;
  action: TaskActivityAction | string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type EmployeeWorkload = {
  userId: string;
  activeTaskCount: number;
  estimatedHours: number;
};
