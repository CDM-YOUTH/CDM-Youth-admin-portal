-- Step 1 of 2: add 'leader' to the app_role enum, for parish/deanery leaders.
-- Must be committed before the value can be used in policies (step 2) —
-- mirrors how 'office' was added in 20260606000002_role_office.sql.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'leader';
