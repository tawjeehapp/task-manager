-- Require project end (due) date. Backfill nulls from start_date or created_at.
UPDATE public.projects
SET end_date = COALESCE(start_date, (created_at AT TIME ZONE 'UTC')::date)
WHERE end_date IS NULL;

ALTER TABLE public.projects
  ALTER COLUMN end_date SET NOT NULL;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_end_date_after_start_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_end_date_after_start_check
  CHECK (start_date IS NULL OR end_date >= start_date);

-- Task due dates must not exceed the parent project's end date (when set).
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_due_within_project_end;

CREATE OR REPLACE FUNCTION public.enforce_task_due_within_project_end()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_project_end date;
BEGIN
  IF NEW.due_date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT end_date INTO v_project_end
  FROM public.projects
  WHERE id = NEW.project_id;

  IF v_project_end IS NOT NULL AND NEW.due_date > v_project_end THEN
    RAISE EXCEPTION 'TASK_DUE_AFTER_PROJECT_END'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_enforce_due_within_project_end ON public.tasks;

CREATE TRIGGER tasks_enforce_due_within_project_end
BEFORE INSERT OR UPDATE OF due_date, project_id
ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.enforce_task_due_within_project_end();

-- Reject project end_date shrinks that would leave tasks past the new end.
CREATE OR REPLACE FUNCTION public.enforce_project_end_covers_tasks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_conflict_count integer;
BEGIN
  IF NEW.end_date IS NOT DISTINCT FROM OLD.end_date THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::integer INTO v_conflict_count
  FROM public.tasks
  WHERE project_id = NEW.id
    AND due_date IS NOT NULL
    AND due_date > NEW.end_date;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'PROJECT_END_BEFORE_TASK_DUE'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_enforce_end_covers_tasks ON public.projects;

CREATE TRIGGER projects_enforce_end_covers_tasks
BEFORE UPDATE OF end_date
ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.enforce_project_end_covers_tasks();
