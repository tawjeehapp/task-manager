-- Per-employee weekly capacity in hours (Sun–Thu work week; default 40 = 5 × 8).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS weekly_capacity_hours numeric NOT NULL DEFAULT 40;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_weekly_capacity_hours_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_weekly_capacity_hours_check
  CHECK (weekly_capacity_hours > 0 AND weekly_capacity_hours <= 80);
