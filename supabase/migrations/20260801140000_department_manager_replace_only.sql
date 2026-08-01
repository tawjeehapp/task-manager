-- Replace-only department managers: prevent orphaning via user delete.
ALTER TABLE public.departments
  DROP CONSTRAINT IF EXISTS departments_manager_id_fkey;

ALTER TABLE public.departments
  ADD CONSTRAINT departments_manager_id_fkey
  FOREIGN KEY (manager_id)
  REFERENCES public.users (id)
  ON DELETE RESTRICT;
