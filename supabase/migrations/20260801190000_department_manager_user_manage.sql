-- Department managers may create/edit employees in their managed department
-- (scoped in application services; role locked to employee).
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'department_manager', p.id
FROM public.permissions p
WHERE p.code = 'user.manage'
ON CONFLICT DO NOTHING;
