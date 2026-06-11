-- ================================================================
-- CDM Youth Office — one-shot setup
-- Run this entire script in the Supabase SQL Editor
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------
-- 1. profiles table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  phone       text,
  position    text,
  deanery_id  uuid        REFERENCES public.deaneries(id) ON DELETE SET NULL,
  parish_id   uuid        REFERENCES public.parishes(id)  ON DELETE SET NULL,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT                  ON public.profiles TO anon;
GRANT ALL                     ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;

CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING  (auth.uid() = id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "profiles_delete_admin"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile row whenever a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- 2. Add 'office' role to enum (safe insert via pg_enum catalog)
--    Avoids the "must commit before use" transaction restriction.
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.app_role'::regtype
      AND enumlabel = 'office'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'office';
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 3. CDM Office user
-- ----------------------------------------------------------------
DO $$
DECLARE
  _uid uuid;
BEGIN
  -- Look up existing user first
  SELECT id INTO _uid FROM auth.users
  WHERE email = 'cdmoffice@diocese.ke' LIMIT 1;

  IF _uid IS NULL THEN
    _uid := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at
    ) VALUES (
      _uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'cdmoffice@diocese.ke',
      crypt('office123', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"CDM Office"}'::jsonb,
      false,
      now(), now()
    );

    -- Identity record — required for email/password login
    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      _uid,
      'cdmoffice@diocese.ke',
      jsonb_build_object(
        'sub',            _uid::text,
        'email',          'cdmoffice@diocese.ke',
        'email_verified', true
      ),
      'email',
      now(), now(), now()
    );

    RAISE NOTICE 'Created auth user %', _uid;
  ELSE
    -- User exists — reset password and confirm email
    UPDATE auth.users SET
      encrypted_password = crypt('office123', gen_salt('bf', 10)),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at         = now()
    WHERE id = _uid;

    RAISE NOTICE 'Updated existing user %', _uid;
  END IF;

  -- Profile
  INSERT INTO public.profiles (id, full_name, position)
  VALUES (_uid, 'CDM Office', 'Office')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    position  = EXCLUDED.position;

  -- Assign office role (enum value added in step 2 above)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'office')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Done — cdmoffice@diocese.ke is ready';
END $$;

-- ----------------------------------------------------------------
-- 4. Update policies to also honour 'office' role
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
CREATE POLICY "user_roles_admin_all"
  ON public.user_roles FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
  );

DROP POLICY IF EXISTS "profiles_update"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;

CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    auth.uid() = id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
  )
  WITH CHECK (
    auth.uid() = id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
  );

CREATE POLICY "profiles_delete_admin"
  ON public.profiles FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
  );

-- ----------------------------------------------------------------
-- 5. Backfill profiles for any auth users created before this ran
-- ----------------------------------------------------------------
INSERT INTO public.profiles (id, full_name)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1))
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
