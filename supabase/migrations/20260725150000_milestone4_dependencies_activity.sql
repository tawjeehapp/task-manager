-- Milestone 4: Task dependencies and activity logs
-- Writes are performed via service role from the application layer.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT task_dependencies_no_self CHECK (task_id <> depends_on_task_id),
  CONSTRAINT task_dependencies_unique UNIQUE (task_id, depends_on_task_id)
);

CREATE INDEX task_dependencies_task_id_idx ON public.task_dependencies (task_id);
CREATE INDEX task_dependencies_depends_on_task_id_idx
  ON public.task_dependencies (depends_on_task_id);

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX activity_logs_entity_idx
  ON public.activity_logs (entity_type, entity_id);
CREATE INDEX activity_logs_user_id_idx ON public.activity_logs (user_id);
CREATE INDEX activity_logs_created_at_idx ON public.activity_logs (created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_dependencies_select_scoped
ON public.task_dependencies
FOR SELECT
TO authenticated
USING (
  public.can_access_task(task_id)
  OR public.can_access_task(depends_on_task_id)
);

CREATE POLICY activity_logs_select_task_scoped
ON public.activity_logs
FOR SELECT
TO authenticated
USING (
  entity_type = 'task'
  AND public.can_access_task(entity_id)
);

-- No INSERT/UPDATE/DELETE policies for authenticated — app uses service role.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_dependencies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_logs TO service_role;

GRANT SELECT ON public.task_dependencies TO authenticated;
GRANT SELECT ON public.activity_logs TO authenticated;
