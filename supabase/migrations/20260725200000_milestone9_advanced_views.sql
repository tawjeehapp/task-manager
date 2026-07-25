-- Milestone 9: Advanced views — task comments, attachments, Storage bucket.
-- Writes use service role. Authorization remains in the application service layer.
-- No new permission codes; access reuses project.view + can_access_task.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT task_comments_content_not_blank CHECK (length(trim(content)) > 0)
);

CREATE TRIGGER task_comments_set_updated_at
BEFORE UPDATE ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX task_comments_task_id_idx ON public.task_comments (task_id);
CREATE INDEX task_comments_user_id_idx ON public.task_comments (user_id);
CREATE INDEX task_comments_created_at_idx
  ON public.task_comments (task_id, created_at DESC);

CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.users (id),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  byte_size bigint NOT NULL DEFAULT 0,
  content_type text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT task_attachments_file_name_not_blank CHECK (length(trim(file_name)) > 0),
  CONSTRAINT task_attachments_storage_path_not_blank CHECK (length(trim(storage_path)) > 0),
  CONSTRAINT task_attachments_byte_size_nonneg CHECK (byte_size >= 0)
);

CREATE INDEX task_attachments_task_id_idx ON public.task_attachments (task_id);
CREATE INDEX task_attachments_uploaded_by_idx ON public.task_attachments (uploaded_by);
CREATE UNIQUE INDEX task_attachments_storage_path_uidx
  ON public.task_attachments (storage_path);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_comments_select_scoped
ON public.task_comments
FOR SELECT
TO authenticated
USING (public.can_access_task(task_id));

CREATE POLICY task_attachments_select_scoped
ON public.task_attachments
FOR SELECT
TO authenticated
USING (public.can_access_task(task_id));

-- No INSERT/UPDATE/DELETE policies for authenticated — app uses service role.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO service_role;

GRANT SELECT ON public.task_comments TO authenticated;
GRANT SELECT ON public.task_attachments TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket (private; uploads/downloads via service role signed URLs)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-files',
  'task-files',
  false,
  10485760,
  NULL
)
ON CONFLICT (id) DO NOTHING;
