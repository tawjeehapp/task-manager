-- Remove announcement expiry lifecycle: announcements stay until deleted.

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_expiry_order_check;

DROP INDEX IF EXISTS public.announcements_expires_at_idx;

ALTER TABLE public.announcements
  DROP COLUMN IF EXISTS expires_at;
