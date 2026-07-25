-- Milestone 8: Dashboards and Reporting
-- No new entity tables. Aggregates use service role + application authz.
-- Seeds report.view for admin and department_manager.

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (code, description)
VALUES
  ('report.view', 'View operational dashboards reports (company or department scoped)')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', p.id
FROM public.permissions p
WHERE p.code = 'report.view'
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'department_manager', p.id
FROM public.permissions p
WHERE p.code = 'report.view'
ON CONFLICT (role, permission_id) DO NOTHING;
