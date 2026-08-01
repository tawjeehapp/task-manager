-- Flatten task hierarchy: promote subtasks to top-level, then drop parent_task_id.

UPDATE public.tasks
SET parent_task_id = NULL
WHERE parent_task_id IS NOT NULL;

DROP INDEX IF EXISTS public.tasks_project_parent_idx;
DROP INDEX IF EXISTS public.tasks_parent_task_id_idx;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_no_self_parent;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_parent_task_id_fkey;

ALTER TABLE public.tasks
  DROP COLUMN IF EXISTS parent_task_id;

CREATE INDEX IF NOT EXISTS tasks_project_id_idx
  ON public.tasks (project_id);
