-- Freeze assigned, workable tasks at attendance submit/resubmit time for manager review.

ALTER TABLE public.attendance_records
  ADD COLUMN eligible_tasks_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;
