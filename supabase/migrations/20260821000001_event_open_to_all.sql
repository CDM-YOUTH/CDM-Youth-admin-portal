-- ================================================================
-- Lets an admin explicitly mark an event visible to every org scope,
-- overriding the normal scope-visibility rule (own scope + diocese-wide
-- events only). Needed e.g. for an event organizationally hosted by one
-- deanery that still needs other deaneries' reps to register their
-- people for it.
-- ================================================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS open_to_all boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.open_to_all IS
  'When true, the event is visible to every org scope regardless of its own deanery/parish.';
