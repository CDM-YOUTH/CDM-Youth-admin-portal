-- =========================================================
-- Remove 'level' field from patronage_team
-- Level is now tracked in patron_leadership table
-- patronage_team now only stores base location
-- =========================================================

-- Drop the level-based constraint
ALTER TABLE public.patronage_team DROP CONSTRAINT IF EXISTS patronage_level_fk;

-- Drop the level column
ALTER TABLE public.patronage_team DROP COLUMN IF EXISTS level;

-- Drop the level index
DROP INDEX IF EXISTS patronage_team_level_idx;

-- Add new constraint: patrons must have at least an outstation
ALTER TABLE public.patronage_team
ADD CONSTRAINT patronage_base_location_check CHECK (
  outstation_id IS NOT NULL
  AND parish_id IS NOT NULL
  AND deanery_id IS NOT NULL
);
