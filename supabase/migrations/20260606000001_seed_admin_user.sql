-- ============================================================
-- Seed: CDM Office admin account
-- Email:    cdmoffice@diocese.ke
-- Password: office123
-- Role:     admin (full access)
--
-- NOTE: Run scripts/seed-admin.mjs instead of this file.
-- Direct auth.users inserts are unreliable — the Node script
-- uses supabase.auth.admin.createUser() which is the correct API.
-- This file is kept as a fallback for profile + role only
-- (assumes the auth user already exists).
-- ============================================================

-- Profile and role for the cdmoffice account.
-- The auth user must already exist (created via dashboard or seed script).
DO $$
DECLARE
  _uid uuid;
BEGIN
  SELECT id INTO _uid
  FROM auth.users
  WHERE email = 'cdmoffice@diocese.ke'
  LIMIT 1;

  IF _uid IS NULL THEN
    RAISE NOTICE 'cdmoffice@diocese.ke not found in auth.users — skipping. Run scripts/seed-admin.mjs first.';
    RETURN;
  END IF;

  INSERT INTO public.profiles (id, full_name, position)
  VALUES (_uid, 'CDM Office', 'Diocese Youth Coordinator')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    position  = EXCLUDED.position;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'office')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Profile and admin role set for user %', _uid;
END $$;
