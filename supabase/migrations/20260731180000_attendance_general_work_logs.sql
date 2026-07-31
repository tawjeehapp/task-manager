-- Explicit general (non-task) attendance time: work_logs.task_id may be null.
-- When task_id is null, description stores the required reason.

ALTER TABLE public.work_logs
  ALTER COLUMN task_id DROP NOT NULL;

ALTER TABLE public.work_logs
  ADD CONSTRAINT work_logs_general_requires_reason_check CHECK (
    task_id IS NOT NULL
    OR (description IS NOT NULL AND btrim(description) <> '')
  );

DROP POLICY IF EXISTS work_logs_select_scoped ON public.work_logs;

CREATE POLICY work_logs_select_scoped
ON public.work_logs
FOR SELECT
TO authenticated
USING (
  user_id = public.current_user_id()
  OR public.is_admin()
  OR public.shares_managed_department_with(user_id)
  OR (task_id IS NOT NULL AND public.can_access_task(task_id))
);
