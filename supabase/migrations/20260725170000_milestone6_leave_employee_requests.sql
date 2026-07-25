-- Milestone 6: Leave management and employee requests (extension / excusal)
-- Writes use service role. Critical mutations use SECURITY DEFINER RPCs for atomicity.
-- Authorization remains in the application service layer.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT leave_types_name_unique UNIQUE (name)
);

CREATE TRIGGER leave_types_set_updated_at
BEFORE UPDATE ON public.leave_types
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  leave_type_id uuid NOT NULL REFERENCES public.leave_types (id),
  allocated_days integer NOT NULL DEFAULT 0,
  used_days integer NOT NULL DEFAULT 0,
  year integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT leave_balances_allocated_check CHECK (allocated_days >= 0),
  CONSTRAINT leave_balances_used_check CHECK (used_days >= 0),
  CONSTRAINT leave_balances_user_type_year_unique UNIQUE (user_id, leave_type_id, year)
);

CREATE TRIGGER leave_balances_set_updated_at
BEFORE UPDATE ON public.leave_balances
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX leave_balances_user_id_idx ON public.leave_balances (user_id);
CREATE INDEX leave_balances_year_idx ON public.leave_balances (year);

CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  leave_type_id uuid NOT NULL REFERENCES public.leave_types (id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  days integer NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES public.users (id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT leave_requests_days_check CHECK (days > 0),
  CONSTRAINT leave_requests_date_order_check CHECK (end_date >= start_date),
  CONSTRAINT leave_requests_same_year_check CHECK (
    EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM end_date)
  ),
  CONSTRAINT leave_requests_status_check CHECK (
    status IN ('pending', 'approved', 'rejected')
  )
);

CREATE TRIGGER leave_requests_set_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX leave_requests_user_id_idx ON public.leave_requests (user_id);
CREATE INDEX leave_requests_status_idx ON public.leave_requests (status);
CREATE INDEX leave_requests_leave_type_id_idx ON public.leave_requests (leave_type_id);
CREATE INDEX leave_requests_dates_idx ON public.leave_requests (start_date, end_date);

CREATE TABLE public.employee_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  type text NOT NULL,
  reason text,
  requested_date date,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.users (id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT employee_requests_type_check CHECK (type IN ('extension', 'excusal')),
  CONSTRAINT employee_requests_status_check CHECK (
    status IN ('pending', 'approved', 'rejected')
  ),
  CONSTRAINT employee_requests_extension_date_check CHECK (
    (type = 'extension' AND requested_date IS NOT NULL)
    OR (type = 'excusal' AND requested_date IS NULL)
  )
);

CREATE TRIGGER employee_requests_set_updated_at
BEFORE UPDATE ON public.employee_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX employee_requests_user_id_idx ON public.employee_requests (user_id);
CREATE INDEX employee_requests_task_id_idx ON public.employee_requests (task_id);
CREATE INDEX employee_requests_status_idx ON public.employee_requests (status);
CREATE INDEX employee_requests_type_idx ON public.employee_requests (type);

CREATE UNIQUE INDEX employee_requests_one_pending_per_type
ON public.employee_requests (user_id, task_id, type)
WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (code, description)
VALUES
  ('leave.view', 'View leave requests and balances (own or scoped)'),
  ('leave.manage', 'Manage leave types and yearly balances'),
  ('employee_request.view', 'View employee task requests (own or scoped)'),
  ('employee_request.create', 'Create task extension or excusal requests'),
  ('employee_request.approve', 'Approve or reject employee task requests')
ON CONFLICT (code) DO NOTHING;

-- leave.approve already exists from M1 (admin). Grant to department managers.
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'department_manager', p.id
FROM public.permissions p
WHERE p.code = 'leave.approve'
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', p.id
FROM public.permissions p
WHERE p.code IN (
  'leave.view',
  'leave.manage',
  'employee_request.view',
  'employee_request.create',
  'employee_request.approve'
)
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'department_manager', p.id
FROM public.permissions p
WHERE p.code IN (
  'leave.view',
  'employee_request.view',
  'employee_request.create',
  'employee_request.approve'
)
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'employee', p.id
FROM public.permissions p
WHERE p.code IN (
  'leave.view',
  'employee_request.view',
  'employee_request.create'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Atomic RPCs (consistency only — authz is enforced in the app layer)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_leave_request(
  p_user_id uuid,
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_days integer,
  p_reason text DEFAULT NULL
)
RETURNS public.leave_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer;
  v_type_active boolean;
  v_balance public.leave_balances%ROWTYPE;
  v_pending_sum integer;
  v_overlap boolean;
  v_row public.leave_requests%ROWTYPE;
BEGIN
  IF p_days IS NULL OR p_days <= 0 THEN
    RAISE EXCEPTION 'INVALID_LEAVE_DAYS'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'INVALID_DATE_RANGE'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXTRACT(YEAR FROM p_start_date) <> EXTRACT(YEAR FROM p_end_date) THEN
    RAISE EXCEPTION 'LEAVE_YEAR_MISMATCH'
      USING ERRCODE = 'P0001';
  END IF;

  v_year := EXTRACT(YEAR FROM p_start_date)::integer;

  SELECT is_active INTO v_type_active
  FROM public.leave_types
  WHERE id = p_leave_type_id;

  IF v_type_active IS NULL THEN
    RAISE EXCEPTION 'LEAVE_TYPE_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_type_active THEN
    RAISE EXCEPTION 'LEAVE_TYPE_INACTIVE'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_balance
  FROM public.leave_balances
  WHERE user_id = p_user_id
    AND leave_type_id = p_leave_type_id
    AND year = v_year
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAVE_BALANCE_MISSING'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(days), 0)::integer
  INTO v_pending_sum
  FROM public.leave_requests
  WHERE user_id = p_user_id
    AND leave_type_id = p_leave_type_id
    AND status = 'pending'
    AND EXTRACT(YEAR FROM start_date) = v_year;

  IF v_balance.allocated_days - v_balance.used_days - v_pending_sum < p_days THEN
    RAISE EXCEPTION 'INSUFFICIENT_LEAVE_BALANCE'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.leave_requests lr
    WHERE lr.user_id = p_user_id
      AND lr.status IN ('pending', 'approved')
      AND lr.start_date <= p_end_date
      AND lr.end_date >= p_start_date
  ) INTO v_overlap;

  IF v_overlap THEN
    RAISE EXCEPTION 'LEAVE_OVERLAP'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.leave_requests (
    user_id,
    leave_type_id,
    start_date,
    end_date,
    days,
    reason,
    status
  )
  VALUES (
    p_user_id,
    p_leave_type_id,
    p_start_date,
    p_end_date,
    p_days,
    NULLIF(trim(p_reason), ''),
    'pending'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_leave_request(
  p_request_id uuid,
  p_approver_id uuid
)
RETURNS public.leave_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.leave_requests%ROWTYPE;
  v_balance public.leave_balances%ROWTYPE;
  v_year integer;
BEGIN
  SELECT *
  INTO v_request
  FROM public.leave_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAVE_REQUEST_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'LEAVE_NOT_PENDING'
      USING ERRCODE = 'P0001';
  END IF;

  v_year := EXTRACT(YEAR FROM v_request.start_date)::integer;

  SELECT *
  INTO v_balance
  FROM public.leave_balances
  WHERE user_id = v_request.user_id
    AND leave_type_id = v_request.leave_type_id
    AND year = v_year
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAVE_BALANCE_MISSING'
      USING ERRCODE = 'P0001';
  END IF;

  -- Approve-time check: committed used only (pending peers not subtracted).
  IF v_balance.allocated_days - v_balance.used_days < v_request.days THEN
    RAISE EXCEPTION 'INSUFFICIENT_LEAVE_BALANCE'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.leave_balances
  SET used_days = used_days + v_request.days
  WHERE id = v_balance.id;

  UPDATE public.leave_requests
  SET
    status = 'approved',
    approved_by = p_approver_id,
    approved_at = timezone('utc', now()),
    rejection_reason = NULL
  WHERE id = v_request.id
  RETURNING * INTO v_request;

  RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_employee_request(
  p_request_id uuid,
  p_reviewer_id uuid
)
RETURNS public.employee_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.employee_requests%ROWTYPE;
  v_task public.tasks%ROWTYPE;
  v_old_due date;
  v_old_assignee uuid;
BEGIN
  SELECT *
  INTO v_request
  FROM public.employee_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMPLOYEE_REQUEST_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'EMPLOYEE_REQUEST_NOT_PENDING'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_task
  FROM public.tasks
  WHERE id = v_request.task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.type = 'extension' THEN
    IF v_request.requested_date IS NULL THEN
      RAISE EXCEPTION 'EXTENSION_DATE_REQUIRED'
        USING ERRCODE = 'P0001';
    END IF;

    v_old_due := v_task.due_date;

    UPDATE public.tasks
    SET due_date = v_request.requested_date
    WHERE id = v_task.id;

    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      p_reviewer_id,
      'task.updated',
      'task',
      v_task.id,
      jsonb_build_object(
        'source', 'employee_request_extension',
        'requestId', v_request.id,
        'fields', jsonb_build_object(
          'due_date', jsonb_build_object(
            'from', to_jsonb(v_old_due),
            'to', to_jsonb(v_request.requested_date)
          )
        )
      )
    );
  ELSIF v_request.type = 'excusal' THEN
    v_old_assignee := v_task.assigned_to;

    IF v_task.assigned_to IS NOT DISTINCT FROM v_request.user_id THEN
      UPDATE public.tasks
      SET assigned_to = NULL
      WHERE id = v_task.id;

      INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES (
        p_reviewer_id,
        'task.assigned',
        'task',
        v_task.id,
        jsonb_build_object(
          'source', 'employee_request_excusal',
          'requestId', v_request.id,
          'fromUserId', v_old_assignee,
          'toUserId', NULL
        )
      );
    END IF;
  ELSE
    RAISE EXCEPTION 'INVALID_EMPLOYEE_REQUEST_TYPE'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.employee_requests
  SET
    status = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = timezone('utc', now()),
    rejection_reason = NULL
  WHERE id = v_request.id
  RETURNING * INTO v_request;

  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_leave_request(uuid, uuid, date, date, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_leave_request(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_employee_request(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_leave_request(uuid, uuid, date, date, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_leave_request(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_employee_request(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY leave_types_select_authenticated
ON public.leave_types
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY leave_balances_select_scoped
ON public.leave_balances
FOR SELECT
TO authenticated
USING (
  user_id = public.current_user_id()
  OR public.is_admin()
  OR public.shares_managed_department_with(user_id)
);

CREATE POLICY leave_requests_select_scoped
ON public.leave_requests
FOR SELECT
TO authenticated
USING (
  user_id = public.current_user_id()
  OR public.is_admin()
  OR public.shares_managed_department_with(user_id)
);

CREATE POLICY employee_requests_select_scoped
ON public.employee_requests
FOR SELECT
TO authenticated
USING (
  user_id = public.current_user_id()
  OR public.is_admin()
  OR public.shares_managed_department_with(user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_types TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_balances TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_requests TO service_role;

GRANT SELECT ON public.leave_types TO authenticated;
GRANT SELECT ON public.leave_balances TO authenticated;
GRANT SELECT ON public.leave_requests TO authenticated;
GRANT SELECT ON public.employee_requests TO authenticated;
