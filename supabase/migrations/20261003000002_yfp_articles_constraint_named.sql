-- Explicitly drop and recreate YFP articles constraint with proper naming
-- First, try to drop any existing unique constraints on these columns
ALTER TABLE public.yfp_weekly_articles
DROP CONSTRAINT IF EXISTS yfp_weekly_articles_pillar_id_sub_pillar_id_liturgical_year_key CASCADE;

ALTER TABLE public.yfp_weekly_articles
DROP CONSTRAINT IF EXISTS yfp_weekly_articles_pillar_id_sub_pillar_id_liturgical_year_week_number_key CASCADE;

-- Add the correct named constraint that allows multiple weeks per year
ALTER TABLE public.yfp_weekly_articles
ADD CONSTRAINT yfp_articles_unique_per_week
UNIQUE(pillar_id, sub_pillar_id, liturgical_year, week_number);
