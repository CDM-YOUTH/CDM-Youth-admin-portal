-- ================================================================
-- Fix login: remove broken user + problematic trigger,
-- then recreate user cleanly.
-- ================================================================

-- 1. Remove the trigger we added — it can interfere with GoTrue's
--    internal auth flow (GoTrue has its own auth.users triggers).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Delete the broken manually-inserted user
DELETE FROM auth.identities WHERE provider_id = 'cdmoffice@diocese.ke';
DELETE FROM auth.users      WHERE email       = 'cdmoffice@diocese.ke';

-- Verify it's gone
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'cdmoffice@diocese.ke') THEN
    RAISE EXCEPTION 'User still exists — delete failed';
  ELSE
    RAISE NOTICE 'User deleted OK. Now go to Authentication > Users > Add user in the Supabase dashboard.';
  END IF;
END $$;
