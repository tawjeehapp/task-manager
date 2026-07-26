-- Composite indexes for hot list/scope filters (fewer sequential scans on memberships/tasks/projects).

CREATE INDEX IF NOT EXISTS department_memberships_department_current_idx
  ON public.department_memberships (department_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS tasks_project_parent_idx
  ON public.tasks (project_id, parent_task_id);

CREATE INDEX IF NOT EXISTS projects_department_status_idx
  ON public.projects (department_id, status);
