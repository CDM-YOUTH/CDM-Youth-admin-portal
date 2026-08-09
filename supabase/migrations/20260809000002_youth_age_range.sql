-- Add age_range text column to youths for storing range values like "18-25".
-- The existing age int column keeps the lower bound for numeric analytics.
ALTER TABLE public.youths ADD COLUMN IF NOT EXISTS age_range text;
