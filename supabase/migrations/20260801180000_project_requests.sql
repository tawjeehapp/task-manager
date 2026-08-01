-- Project due-date extension requests (DM → admin).

CREATE TABLE public.project_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  type text NOT NULL,
  reason text,
  requested_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.users (id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT project_requests_type_check CHECK (type IN ('extension')),
  CONSTRAINT project_requests_status_check CHECK (
    status IN ('pending', 'approved', 'rejected')
  )
);

CREATE TRIGGER project_requests_set_updated_at
BEFORE UPDATE ON public.project_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX project_requests_user_id_idx ON public.project_requests (user_id);
CREATE INDEX project_requests_project_id_idx ON public.project_requests (project_id);
CREATE INDEX project_requests_status_idx ON public.project_requests (status);
CREATE INDEX project_requests_type_idx ON public.project_requests (type);

CREATE UNIQUE INDEX project_requests_one_pending_per_type
ON public.project_requests (project_id, type)
WHERE status = 'pending';

INSERT INTO public.permissions (code, description)
VALUES
  ('project_request.view', 'View project due-date extension requests (own or scoped)'),
  ('project_request.create', 'Create project due-date extension requests'),
  ('project_request.approve', 'Approve or reject project due-date extension requests')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', p.id
FROM public.permissions p
WHERE p.code IN (
  'project_request.view',
  'project_request.create',
  'project_request.approve'
)
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'department_manager', p.id
FROM public.permissions p
WHERE p.code IN (
  'project_request.view',
  'project_request.create'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Allow notifications to deep-link project requests to /approvals.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_entity_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_entity_type_check CHECK (
    entity_type IS NULL
    OR entity_type IN (
      'task',
      'leave_request',
      'employee_request',
      'attendance_record',
      'announcement',
      'project_request'
    )
  );

CREATE OR REPLACE FUNCTION public.approve_project_request(
  p_request_id uuid,
  p_reviewer_id uuid
)
RETURNS public.project_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.project_requests%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_old_end date;
BEGIN
  SELECT *
  INTO v_request
  FROM public.project_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_REQUEST_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'PROJECT_REQUEST_NOT_PENDING'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.type <> 'extension' THEN
    RAISE EXCEPTION 'INVALID_PROJECT_REQUEST_TYPE'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_project
  FROM public.projects
  WHERE id = v_request.project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.requested_date <= v_project.end_date THEN
    RAISE EXCEPTION 'PROJECT_EXTENSION_DATE_INVALID'
      USING ERRCODE = 'P0001';
  END IF;

  v_old_end := v_project.end_date;

  UPDATE public.projects
  SET end_date = v_request.requested_date
  WHERE id = v_project.id;

  UPDATE public.project_requests
  SET
    status = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = timezone('utc', now()),
    rejection_reason = NULL
  WHERE id = v_request.id
  RETURNING * INTO v_request;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (
    p_reviewer_id,
    'project.updated',
    'project',
    v_project.id,
    jsonb_build_object(
      'source', 'project_request_extension',
      'requestId', v_request.id,
      'fields', jsonb_build_object(
        'end_date', jsonb_build_object(
          'from', to_jsonb(v_old_end),
          'to', to_jsonb(v_request.requested_date)
        )
      )
    )
  );

  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_project_request(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_project_request(uuid, uuid) TO service_role;
