-- Milestone 4 follow-up: simplify task statuses to
-- todo | in_progress | blocked | completed

UPDATE public.tasks
SET status = 'in_progress'
WHERE status = 'review';

UPDATE public.tasks
SET status = 'todo',
    completed_at = NULL
WHERE status = 'cancelled';

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check CHECK (
    status IN ('todo', 'in_progress', 'blocked', 'completed')
  );
