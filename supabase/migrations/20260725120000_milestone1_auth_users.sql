-- Milestone 1: Authentication and User Management
-- RLS helpers are SECURITY DEFINER to avoid recursive policy evaluation on public.users.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums / check constraints via text + CHECK (keeps migrations simple)
-- ---------------------------------------------------------------------------

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  employee_number text NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  avatar_url text,
  role text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT users_employee_number_format CHECK (employee_number ~ '^\d{4}$'),
  CONSTRAINT users_role_check CHECK (
    role IN ('admin', 'department_manager', 'employee')
  )
);

CREATE INDEX users_employee_number_idx ON public.users (employee_number);
CREATE INDEX users_auth_user_id_idx ON public.users (auth_user_id);
CREATE INDEX users_role_idx ON public.users (role);
CREATE INDEX users_is_active_idx ON public.users (is_active);

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT role_permissions_role_check CHECK (
    role IN ('admin', 'department_manager', 'employee')
  ),
  CONSTRAINT role_permissions_role_permission_unique UNIQUE (role, permission_id)
);

CREATE INDEX role_permissions_role_idx ON public.role_permissions (role);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers (bypass RLS; do not call from untrusted SQL)
-- Policies must use these helpers instead of selecting from public.users.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE auth_user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

GRANT EXECUTE ON FUNCTION public.current_user_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- ---------------------------------------------------------------------------
-- Seed permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (code, description) VALUES
  ('user.manage', 'Create, update, deactivate, and delete users'),
  ('user.reset_password', 'Reset another user password (admin in M1)'),
  ('task.create', 'Create tasks'),
  ('task.assign', 'Assign tasks'),
  ('attendance.approve', 'Approve attendance records'),
  ('leave.approve', 'Approve leave requests'),
  ('department.manage', 'Manage departments');

-- Admin receives all permissions in M1.
-- department_manager and employee receive no user-management permissions yet.
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', p.id
FROM public.permissions p;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- users: no recursive self-select in policies (role via is_admin() only)
CREATE POLICY users_select_own_or_admin
ON public.users
FOR SELECT
TO authenticated
USING (
  auth_user_id = auth.uid()
  OR public.is_admin()
);

CREATE POLICY users_update_admin
ON public.users
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- No INSERT/DELETE policies for authenticated — provisioning uses service_role

CREATE POLICY permissions_select_authenticated
ON public.permissions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY role_permissions_select_authenticated
ON public.role_permissions
FOR SELECT
TO authenticated
USING (true);

-- Service role bypasses RLS by default in Supabase; grants for clarity
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO service_role;

GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE ON public.users TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;
