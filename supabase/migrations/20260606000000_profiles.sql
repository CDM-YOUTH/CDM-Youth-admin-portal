-- ============================================================
-- profiles: extended details for every admin / staff account
-- Linked 1-to-1 with auth.users; auto-created on signup via trigger.
-- ============================================================

CREATE TABLE public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  phone       text,
  -- free-text job title, e.g. "Diocese Youth Coordinator", "Deanery Moderator"
  position    text,
  -- optional org scope — set for deanery- or parish-level admins
  deanery_id  uuid        REFERENCES public.deaneries(id) ON DELETE SET NULL,
  parish_id   uuid        REFERENCES public.parishes(id)  ON DELETE SET NULL,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---- permissions ----
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT                  ON public.profiles TO anon;
GRANT ALL                     ON public.profiles TO service_role;

-- ---- RLS ----
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- any authenticated user can read any profile (admins need to see each other)
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- users insert only their own row (trigger handles normal signup flow)
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- users update their own; admins update anyone
CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    auth.uid() = id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    auth.uid() = id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- only admins can delete profiles
CREATE POLICY "profiles_delete_admin"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ---- auto-create profile on new signup ----
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---- keep updated_at current ----
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- backfill any existing auth users that have no profile yet ----
INSERT INTO public.profiles (id, full_name)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1))
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);
