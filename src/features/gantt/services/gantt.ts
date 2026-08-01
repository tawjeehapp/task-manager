import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { assertCanAccessProject } from "@/features/projects/services/assert-can-access-project";
import type { GanttQuery } from "@/features/gantt/schemas/gantt.schema";
import type {
  GanttDependency,
  GanttTask,
  ProjectGanttResult,
} from "@/features/gantt/types/gantt.types";
import {
  isTaskOverdue,
  resolveBarDates,
} from "@/features/gantt/lib/gantt-helpers";
import { addCalendarDays, todayInOrgTimezone } from "@/lib/org-calendar";
import { createAdminClient } from "@/lib/supabase/admin";

type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  start_date: string | null;
  due_date: string | null;
  progress_percentage: number;
  created_at: string;
  assignee: { full_name: string } | null;
};

export { isTaskOverdue, resolveBarDates };

export async function getProjectGantt(
  viewer: AppUser,
  projectId: string,
  query: GanttQuery,
): Promise<ProjectGanttResult> {
  await assertCanAccessProject(viewer, projectId);
  const admin = createAdminClient();
  const today = todayInOrgTimezone();

  let builder = admin
    .from("tasks")
    .select(
      "id, title, status, priority, assigned_to, start_date, due_date, progress_percentage, created_at, assignee:users!assigned_to(full_name)",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (query.status) {
    builder = builder.eq("status", query.status);
  }
  if (query.assignee) {
    builder = builder.eq("assigned_to", query.assignee);
  }
  if (query.dueFrom) {
    builder = builder.gte("due_date", query.dueFrom);
  }
  if (query.dueTo) {
    builder = builder.lte("due_date", query.dueTo);
  }

  const { data, error } = await builder;
  if (error) {
    throw new ApiError("تعذر جلب بيانات مخطط جانت.", 500, "GANTT_FAILED");
  }

  const rows = (data ?? []) as unknown as TaskRow[];
  const taskIds = rows.map((row) => row.id);

  let dependencies: GanttDependency[] = [];
  if (taskIds.length > 0) {
    const { data: depRows, error: depError } = await admin
      .from("task_dependencies")
      .select("task_id, depends_on_task_id")
      .in("task_id", taskIds);

    if (depError) {
      throw new ApiError(
        "تعذر جلب تبعيات مخطط جانت.",
        500,
        "GANTT_DEPS_FAILED",
      );
    }

    const idSet = new Set(taskIds);
    dependencies = (depRows ?? [])
      .filter(
        (row) =>
          idSet.has(row.task_id as string) &&
          idSet.has(row.depends_on_task_id as string),
      )
      .map((row) => ({
        taskId: row.task_id as string,
        dependsOnTaskId: row.depends_on_task_id as string,
      }));
  }

  const tasks: GanttTask[] = rows.map((row) => {
    const { barStart, barEnd } = resolveBarDates({
      startDate: row.start_date,
      dueDate: row.due_date,
      createdAt: row.created_at,
    });
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      assignedTo: row.assigned_to,
      assigneeName: row.assignee?.full_name ?? null,
      startDate: row.start_date,
      dueDate: row.due_date,
      barStart,
      barEnd,
      progressPercentage: Number(row.progress_percentage ?? 0),
      overdue: isTaskOverdue({
        dueDate: row.due_date,
        status: row.status,
        today,
      }),
    };
  });

  let rangeStart = today;
  let rangeEnd = today;
  if (tasks.length > 0) {
    rangeStart = tasks.reduce(
      (min, task) => (task.barStart < min ? task.barStart : min),
      tasks[0]!.barStart,
    );
    rangeEnd = tasks.reduce(
      (max, task) => (task.barEnd > max ? task.barEnd : max),
      tasks[0]!.barEnd,
    );
    rangeStart = addCalendarDays(rangeStart, -3);
    rangeEnd = addCalendarDays(rangeEnd, 7);
  }

  return {
    projectId,
    tasks,
    dependencies,
    rangeStart,
    rangeEnd,
  };
}
