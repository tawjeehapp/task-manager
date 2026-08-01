-- Remove report.view permission (reporting feature retired).

DELETE FROM public.role_permissions
WHERE permission_id IN (
  SELECT id FROM public.permissions WHERE code = 'report.view'
);

DELETE FROM public.permissions
WHERE code = 'report.view';
