export type WorkLog = {
  id: string;
  userId: string;
  taskId: string | null;
  date: string;
  hours: number;
  description: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    fullName: string;
    employeeNumber: string;
  } | null;
  task?: {
    id: string;
    title: string;
    projectId: string;
  } | null;
};

export type WorkLogRow = {
  id: string;
  user_id: string;
  task_id: string | null;
  date: string;
  hours: number | string;
  description: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string;
    employee_number: string;
  } | null;
  task?: {
    id: string;
    title: string;
    project_id: string;
  } | null;
};

export function mapWorkLogRow(row: WorkLogRow): WorkLog {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    date: row.date,
    hours: Number(row.hours),
    description: row.description,
    approvedBy: row.approved_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: row.user
      ? {
          id: row.user.id,
          fullName: row.user.full_name,
          employeeNumber: row.user.employee_number,
        }
      : null,
    task: row.task
      ? {
          id: row.task.id,
          title: row.task.title,
          projectId: row.task.project_id,
        }
      : null,
  };
}
