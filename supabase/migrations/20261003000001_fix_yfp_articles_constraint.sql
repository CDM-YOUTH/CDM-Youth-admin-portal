-- Fix YFP Weekly Articles Constraint to allow multiple articles per year per week
-- Drop the restrictive unique constraint that only includes (pillar_id, sub_pillar_id, liturgical_year)
-- and replace with one that includes week_number to allow multiple weeks per year

ALTER TABLE public.yfp_weekly_articles
DROP CONSTRAINT IF EXISTS yfp_weekly_articles_pillar_id_sub_pillar_id_liturgical_year_key;

-- Add the correct constraint that allows multiple weeks per year
ALTER TABLE public.yfp_weekly_articles
ADD UNIQUE(pillar_id, sub_pillar_id, liturgical_year, week_number);
