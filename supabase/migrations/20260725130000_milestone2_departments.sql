-- Milestone 2: Organization Structure (departments + memberships)
-- RLS helpers are SECURITY DEFINER to avoid recursive policy evaluation.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  manager_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT departments_status_check CHECK (status IN ('active', 'archived'))
);

CREATE INDEX departments_status_idx ON public.departments (status);
CREATE INDEX departments_manager_id_idx ON public.departments (manager_id);

-- At most one managed department per manager
CREATE UNIQUE INDEX departments_one_manager_per_user_idx
  ON public.departments (manager_id)
  WHERE manager_id IS NOT NULL;

CREATE TRIGGER departments_set_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.department_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments (id),
  user_id uuid NOT NULL REFERENCES public.users (id),
  start_date date NOT NULL DEFAULT (timezone('utc', now()))::date,
  end_date date,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT department_memberships_current_end_date_check CHECK (
    (is_current = true AND end_date IS NULL)
    OR (is_current = false AND end_date IS NOT NULL)
  )
);

CREATE INDEX department_memberships_department_id_idx
  ON public.department_memberships (department_id);
CREATE INDEX department_memberships_user_id_idx
  ON public.department_memberships (user_id);
CREATE INDEX department_memberships_is_current_idx
  ON public.department_memberships (is_current);

-- At most one current membership per user
CREATE UNIQUE INDEX department_memberships_one_current_per_user_idx
  ON public.department_memberships (user_id)
  WHERE is_current = true;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_department_manager()
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
      AND role = 'department_manager'
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.manages_department(dept_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.departments d
    WHERE d.id = dept_id
      AND d.manager_id = public.current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_member_of(dept_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.department_memberships m
    WHERE m.department_id = dept_id
      AND m.user_id = public.current_user_id()
      AND m.is_current = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_department_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.department_id
  FROM public.department_memberships m
  WHERE m.user_id = public.current_user_id()
    AND m.is_current = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.shares_managed_department_with(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.department_memberships m
    INNER JOIN public.departments d ON d.id = m.department_id
    WHERE m.user_id = target_user_id
      AND m.is_current = true
      AND d.manager_id = public.current_user_id()
  );
$$;

REVOKE ALL ON FUNCTION public.is_department_manager() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.manages_department(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_current_member_of(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_department_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shares_managed_department_with(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_department_manager() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.manages_department(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_current_member_of(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_department_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shares_managed_department_with(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Permissions seed (idempotent)
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (code, description)
VALUES ('department.view', 'View departments and memberships')
ON CONFLICT (code) DO NOTHING;

UPDATE public.permissions
SET description = 'Reset another user password (admin any; department manager for subordinates)'
WHERE code = 'user.reset_password';

-- Admin gets any newly inserted permissions
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', p.id
FROM public.permissions p
WHERE p.code = 'department.view'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Department managers: view departments + reset subordinate passwords
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'department_manager', p.id
FROM public.permissions p
WHERE p.code IN ('department.view', 'user.reset_password')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Employees: view own department (scoped in RLS/API)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'employee', p.id
FROM public.permissions p
WHERE p.code = 'department.view'
ON CONFLICT (role, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_memberships ENABLE ROW LEVEL SECURITY;

-- departments SELECT: admin all; manager their managed; employee their current
CREATE POLICY departments_select_scoped
ON public.departments
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR manager_id = public.current_user_id()
  OR id = public.current_department_id()
);

CREATE POLICY departments_insert_admin
ON public.departments
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY departments_update_admin
ON public.departments
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY departments_delete_admin
ON public.departments
FOR DELETE
TO authenticated
USING (public.is_admin());

-- memberships SELECT: admin all; manager members of managed dept; employee own rows
CREATE POLICY department_memberships_select_scoped
ON public.department_memberships
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.manages_department(department_id)
  OR user_id = public.current_user_id()
);

CREATE POLICY department_memberships_insert_admin
ON public.department_memberships
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY department_memberships_update_admin
ON public.department_memberships
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY department_memberships_delete_admin
ON public.department_memberships
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Extend users SELECT so managers can see subordinates in their department
DROP POLICY IF EXISTS users_select_own_or_admin ON public.users;

CREATE POLICY users_select_own_admin_or_subordinate
ON public.users
FOR SELECT
TO authenticated
USING (
  auth_user_id = auth.uid()
  OR public.is_admin()
  OR public.shares_managed_department_with(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_memberships TO service_role;

GRANT SELECT ON public.departments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.departments TO authenticated;

GRANT SELECT ON public.department_memberships TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.department_memberships TO authenticated;
