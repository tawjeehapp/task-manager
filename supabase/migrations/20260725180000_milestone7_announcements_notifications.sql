-- Milestone 7: Announcements and in-app notifications
-- Writes use service role. Authorization remains in the application service layer.
-- Announcement file attachments and Web Push delivery are deferred.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  audience_type text NOT NULL,
  department_id uuid REFERENCES public.departments (id),
  priority text NOT NULL DEFAULT 'medium',
  publish_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.users (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT announcements_audience_check CHECK (
    audience_type IN ('company', 'department')
  ),
  CONSTRAINT announcements_priority_check CHECK (
    priority IN ('low', 'medium', 'high')
  ),
  CONSTRAINT announcements_department_audience_check CHECK (
    (audience_type = 'company' AND department_id IS NULL)
    OR (audience_type = 'department' AND department_id IS NOT NULL)
  ),
  CONSTRAINT announcements_expiry_order_check CHECK (
    expires_at IS NULL OR expires_at > publish_at
  )
);

CREATE TRIGGER announcements_set_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX announcements_audience_type_idx ON public.announcements (audience_type);
CREATE INDEX announcements_department_id_idx ON public.announcements (department_id);
CREATE INDEX announcements_priority_idx ON public.announcements (priority);
CREATE INDEX announcements_publish_at_idx ON public.announcements (publish_at DESC);
CREATE INDEX announcements_expires_at_idx ON public.announcements (expires_at);

CREATE TABLE public.announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id),
  read_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT announcement_reads_unique UNIQUE (announcement_id, user_id)
);

CREATE INDEX announcement_reads_user_id_idx ON public.announcement_reads (user_id);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT notifications_type_check CHECK (
    type IN (
      'task_assigned',
      'task_completed',
      'approval_request',
      'approval_result',
      'announcement'
    )
  ),
  CONSTRAINT notifications_entity_type_check CHECK (
    entity_type IS NULL
    OR entity_type IN (
      'task',
      'leave_request',
      'employee_request',
      'attendance_record',
      'announcement'
    )
  )
);

CREATE INDEX notifications_user_id_idx ON public.notifications (user_id);
CREATE INDEX notifications_user_unread_idx
  ON public.notifications (user_id)
  WHERE read_at IS NULL;
CREATE INDEX notifications_created_at_idx ON public.notifications (created_at DESC);
CREATE INDEX notifications_type_idx ON public.notifications (type);

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (code, description)
VALUES
  ('announcement.view', 'View company and department announcements'),
  ('announcement.manage', 'Create and manage announcements'),
  ('notification.view', 'View own in-app notifications')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', p.id
FROM public.permissions p
WHERE p.code IN (
  'announcement.view',
  'announcement.manage',
  'notification.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'department_manager', p.id
FROM public.permissions p
WHERE p.code IN (
  'announcement.view',
  'announcement.manage',
  'notification.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'employee', p.id
FROM public.permissions p
WHERE p.code IN (
  'announcement.view',
  'notification.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY announcements_select_scoped
ON public.announcements
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR (
    audience_type = 'company'
    AND publish_at <= timezone('utc', now())
  )
  OR (
    audience_type = 'department'
    AND department_id IS NOT NULL
    AND public.is_current_member_of(department_id)
    AND publish_at <= timezone('utc', now())
  )
  OR created_by = public.current_user_id()
);

CREATE POLICY announcement_reads_select_own
ON public.announcement_reads
FOR SELECT
TO authenticated
USING (
  user_id = public.current_user_id()
  OR public.is_admin()
);

CREATE POLICY notifications_select_own
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = public.current_user_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcement_reads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;

GRANT SELECT ON public.announcements TO authenticated;
GRANT SELECT ON public.announcement_reads TO authenticated;
GRANT SELECT ON public.notifications TO authenticated;
