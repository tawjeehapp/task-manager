-- Milestone 3: Projects and Tasks
-- RLS helpers are SECURITY DEFINER to avoid recursive policy evaluation.
-- Writes are performed via service role from the application layer.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments (id),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  priority text NOT NULL DEFAULT 'medium',
  start_date date,
  end_date date,
  created_by uuid NOT NULL REFERENCES public.users (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT projects_status_check CHECK (
    status IN ('draft', 'active', 'completed', 'archived')
  ),
  CONSTRAINT projects_priority_check CHECK (
    priority IN ('low', 'medium', 'high')
  )
);

CREATE INDEX projects_department_id_idx ON public.projects (department_id);
CREATE INDEX projects_status_idx ON public.projects (status);
CREATE INDEX projects_created_at_idx ON public.projects (created_at);

CREATE TRIGGER projects_set_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT project_members_project_user_unique UNIQUE (project_id, user_id)
);

CREATE INDEX project_members_project_id_idx ON public.project_members (project_id);
CREATE INDEX project_members_user_id_idx ON public.project_members (user_id);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  parent_task_id uuid REFERENCES public.tasks (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'medium',
  assigned_to uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.users (id),
  start_date date,
  due_date date,
  estimated_hours numeric(8, 2),
  progress_percentage integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT tasks_status_check CHECK (
    status IN ('todo', 'in_progress', 'blocked', 'review', 'completed', 'cancelled')
  ),
  CONSTRAINT tasks_priority_check CHECK (
    priority IN ('low', 'medium', 'high')
  ),
  CONSTRAINT tasks_progress_percentage_check CHECK (
    progress_percentage >= 0 AND progress_percentage <= 100
  ),
  CONSTRAINT tasks_no_self_parent CHECK (parent_task_id IS DISTINCT FROM id)
);

CREATE INDEX tasks_project_id_idx ON public.tasks (project_id);
CREATE INDEX tasks_parent_task_id_idx ON public.tasks (parent_task_id);
CREATE INDEX tasks_status_idx ON public.tasks (status);
CREATE INDEX tasks_assigned_to_idx ON public.tasks (assigned_to);
CREATE INDEX tasks_due_date_idx ON public.tasks (due_date);
CREATE INDEX tasks_created_at_idx ON public.tasks (created_at);

CREATE TRIGGER tasks_set_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = p_project_id
      AND pm.user_id = public.current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND (
        public.is_admin()
        OR public.manages_department(p.department_id)
        OR public.is_project_member(p.id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_task(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = p_task_id
      AND (
        public.can_access_project(t.project_id)
        OR t.assigned_to = public.current_user_id()
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_project_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_project(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_task(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_project_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_task(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Permissions seed (idempotent)
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (code, description)
VALUES
  ('project.view', 'View projects'),
  ('project.manage', 'Create, update, and archive projects (admin only)')
ON CONFLICT (code) DO NOTHING;

-- Admin gets any newly inserted permissions
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', p.id
FROM public.permissions p
WHERE p.code IN ('project.view', 'project.manage')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Department managers: project view + task create/assign (not project.manage)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'department_manager', p.id
FROM public.permissions p
WHERE p.code IN (
  'project.view',
  'task.create',
  'task.assign'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Employees: view projects they belong to (scoped in RLS/API)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'employee', p.id
FROM public.permissions p
WHERE p.code = 'project.view'
ON CONFLICT (role, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_select_scoped
ON public.projects
FOR SELECT
TO authenticated
USING (public.can_access_project(id));

CREATE POLICY project_members_select_scoped
ON public.project_members
FOR SELECT
TO authenticated
USING (public.can_access_project(project_id));

CREATE POLICY tasks_select_scoped
ON public.tasks
FOR SELECT
TO authenticated
USING (
  public.can_access_project(project_id)
  OR assigned_to = public.current_user_id()
);

-- No INSERT/UPDATE/DELETE policies for authenticated — app uses service role.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO service_role;

GRANT SELECT ON public.projects TO authenticated;
GRANT SELECT ON public.project_members TO authenticated;
GRANT SELECT ON public.tasks TO authenticated;
