-- Require positive estimated_hours on tasks (backfill null/non-positive to 1 hour).

UPDATE public.tasks
SET estimated_hours = 1
WHERE estimated_hours IS NULL OR estimated_hours <= 0;

ALTER TABLE public.tasks
  ALTER COLUMN estimated_hours SET DEFAULT 1,
  ALTER COLUMN estimated_hours SET NOT NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_estimated_hours_positive;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_estimated_hours_positive
  CHECK (estimated_hours > 0);
