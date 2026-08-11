-- Add end_date to events so multi-day events can show as "ongoing".
-- Nullable — single-day events leave it NULL (end_date = event_date implied).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS end_date date;
