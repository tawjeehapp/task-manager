export type TaskStatus =
  | "todo"
  | "in_progress"
  | "blocked"
  | "review"
  | "completed"
  | "cancelled";

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

export type Task = {
  id: string;
  projectId: string;
  project: TaskProjectSummary | null;
  parentTaskId: string | null;
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
  subtaskCount?: number;
};

export type TaskRow = {
  id: string;
  project_id: string;
  parent_task_id: string | null;
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
  "review",
  "completed",
  "cancelled",
];
