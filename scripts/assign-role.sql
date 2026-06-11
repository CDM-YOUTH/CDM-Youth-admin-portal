-- Run this AFTER creating the user via the Supabase dashboard UI.
-- Assigns the office role and sets the profile for cdmoffice@diocese.ke.

DO $$
DECLARE
  _uid uuid;
BEGIN
  SELECT id INTO _uid
  FROM auth.users
  WHERE email = 'cdmoffice@diocese.ke'
  LIMIT 1;

  IF _uid IS NULL THEN
    RAISE EXCEPTION 'User cdmoffice@diocese.ke not found — create them via Authentication > Users first';
  END IF;

  -- Profile
  INSERT INTO public.profiles (id, full_name, position)
  VALUES (_uid, 'CDM Office', 'Office')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    position  = EXCLUDED.position;

  -- Office role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'office')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Done — user % assigned office role', _uid;
END $$;
