-- event_registrations.youth_id was created as a bare uuid with no FK constraint.
-- PostgREST requires a declared FK to discover the relationship and allow
-- embedded queries like youth:youths(...).
--
-- NOT VALID skips validating existing rows (avoids failure if orphaned IDs exist).
-- New inserts/updates are still enforced from this point forward.

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_youth_id_fkey;

-- Null out any youth_id values that don't match a real youth (would block the FK)
UPDATE public.event_registrations
SET youth_id = NULL
WHERE youth_id IS NOT NULL
  AND youth_id NOT IN (SELECT id FROM public.youths);

ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_youth_id_fkey
  FOREIGN KEY (youth_id)
  REFERENCES public.youths(id)
  ON DELETE SET NULL
  NOT VALID;

NOTIFY pgrst, 'reload schema';
