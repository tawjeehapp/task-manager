-- Milestone 3 follow-up: only admins may create/edit/archive projects.
-- Department managers keep project.view + task.create/task.assign for in-project work.

DELETE FROM public.role_permissions rp
USING public.permissions p
WHERE rp.permission_id = p.id
  AND rp.role = 'department_manager'
  AND p.code = 'project.manage';
