-- Add location and role fields to guest event registrations.
-- All columns nullable; only populated for walk-in / external guests.

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS guest_deanery   text,
  ADD COLUMN IF NOT EXISTS guest_parish    text,
  ADD COLUMN IF NOT EXISTS guest_outstation text,
  ADD COLUMN IF NOT EXISTS guest_role      text;

NOTIFY pgrst, 'reload schema';
