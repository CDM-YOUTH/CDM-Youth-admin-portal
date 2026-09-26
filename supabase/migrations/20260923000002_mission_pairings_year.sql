-- =========================================================
-- Mission Pairings: Add Year Field
-- Denormalizes year from mission_weeks for easier queries
-- without requiring joins
-- =========================================================

ALTER TABLE public.mission_pairings
  ADD COLUMN IF NOT EXISTS year int;

-- Backfill year from mission_weeks
UPDATE public.mission_pairings mp
SET year = mw.year
FROM public.mission_weeks mw
WHERE mp.mission_week_id = mw.id AND mp.year IS NULL;

-- Make year NOT NULL after backfill
ALTER TABLE public.mission_pairings
  ALTER COLUMN year SET NOT NULL;

-- Add index for efficient annual queries
CREATE INDEX IF NOT EXISTS mission_pairings_year_idx ON public.mission_pairings(year DESC);
CREATE INDEX IF NOT EXISTS mission_pairings_year_status_idx ON public.mission_pairings(year, status);

-- Add foreign key constraint to ensure data consistency
ALTER TABLE public.mission_pairings
  ADD CONSTRAINT mission_pairings_year_fk FOREIGN KEY (year)
    REFERENCES public.mission_weeks(year) ON DELETE CASCADE;
