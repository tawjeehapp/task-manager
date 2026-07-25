-- Milestone 5: Attendance records and work logs
-- Writes are performed via service role from the application layer.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  date date NOT NULL,
  clock_in timestamptz NOT NULL,
  clock_out timestamptz,
  break_minutes integer NOT NULL DEFAULT 0,
  total_hours numeric(6, 2),
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES public.users (id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT attendance_records_user_date_unique UNIQUE (user_id, date),
  CONSTRAINT attendance_records_status_check CHECK (
    status IN ('pending', 'approved', 'rejected')
  ),
  CONSTRAINT attendance_records_break_minutes_check CHECK (break_minutes >= 0),
  CONSTRAINT attendance_records_clock_range_check CHECK (
    clock_out IS NULL OR clock_out > clock_in
  )
);

CREATE INDEX attendance_records_user_id_idx ON public.attendance_records (user_id);
CREATE INDEX attendance_records_date_idx ON public.attendance_records (date);
CREATE INDEX attendance_records_status_idx ON public.attendance_records (status);

CREATE TABLE public.work_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  date date NOT NULL,
  hours numeric(6, 2) NOT NULL,
  description text,
  approved_by uuid REFERENCES public.users (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT work_logs_hours_check CHECK (hours > 0)
);

CREATE INDEX work_logs_user_id_idx ON public.work_logs (user_id);
CREATE INDEX work_logs_task_id_idx ON public.work_logs (task_id);
CREATE INDEX work_logs_date_idx ON public.work_logs (date);
CREATE INDEX work_logs_user_date_idx ON public.work_logs (user_id, date);

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (code, description)
VALUES
  ('attendance.view', 'View attendance records (own or scoped)'),
  ('work_log.create', 'Create work logs against tasks'),
  ('work_log.view', 'View work logs (own or scoped)')
ON CONFLICT (code) DO NOTHING;

-- attendance.approve already exists from M1 (admin). Grant to department managers.
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'department_manager', p.id
FROM public.permissions p
WHERE p.code = 'attendance.approve'
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT r.role, p.id
FROM public.permissions p
CROSS JOIN (
  VALUES
    ('admin'),
    ('department_manager'),
    ('employee')
) AS r(role)
WHERE p.code IN ('attendance.view', 'work_log.create', 'work_log.view')
ON CONFLICT (role, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_records_select_scoped
ON public.attendance_records
FOR SELECT
TO authenticated
USING (
  user_id = public.current_user_id()
  OR public.is_admin()
  OR public.shares_managed_department_with(user_id)
);

CREATE POLICY work_logs_select_scoped
ON public.work_logs
FOR SELECT
TO authenticated
USING (
  user_id = public.current_user_id()
  OR public.is_admin()
  OR public.shares_managed_department_with(user_id)
  OR public.can_access_task(task_id)
);

-- No INSERT/UPDATE/DELETE policies for authenticated — app uses service role.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_logs TO service_role;

GRANT SELECT ON public.attendance_records TO authenticated;
GRANT SELECT ON public.work_logs TO authenticated;
