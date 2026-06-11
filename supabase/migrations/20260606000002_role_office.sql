-- Step 1 of 2: add 'office' to the enum.
-- Must be committed before the value can be used in policies (step 2).
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'office';
