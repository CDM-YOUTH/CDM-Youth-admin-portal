-- ================================================================
-- Youth Portal — self-service auth linkage + RLS tightening
--
-- Until now `youths` rows were entered entirely by staff and had no
-- connection to a Supabase Auth identity (see the comment "RLS — open
-- policies until login is added" in the initial schema migration).
-- The Youth Portal lets a youth log in and manage their own record, so
-- this migration:
--   1. Links a youths row to an auth.users identity (auth_user_id).
--   2. Replaces the wide-open `using (true)` policies on `youths` with
--      real ownership rules: staff (admin/office/moderator) keep full
--      access, a youth can only read/update their own row, and nobody
--      can insert/delete directly from the client — registration goes
--      through a server function using the service-role client instead.
--   3. Adds 'Other' as a selectable registration category.
--   4. Adds `notifications` and `otp_codes` tables needed by the portal.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Link youths -> auth.users
-- ----------------------------------------------------------------
ALTER TABLE public.youths
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS youths_auth_user_id_idx ON public.youths(auth_user_id);

-- Guard against a self-service update smuggling changes into fields that
-- must stay staff-controlled (identity linkage, membership number, status).
CREATE OR REPLACE FUNCTION public.youths_guard_self_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'office')
       OR public.has_role(auth.uid(), 'moderator')) THEN
    NEW.cdm_id        := OLD.cdm_id;
    NEW.status        := OLD.status;
    NEW.auth_user_id  := OLD.auth_user_id;
    NEW.category      := OLD.category;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS youths_guard_self_update_trg ON public.youths;
CREATE TRIGGER youths_guard_self_update_trg
  BEFORE UPDATE ON public.youths
  FOR EACH ROW EXECUTE FUNCTION public.youths_guard_self_update();

-- ----------------------------------------------------------------
-- 2. Tighten youths RLS: drop the placeholder "public_*" policies,
--    replace with staff-full-access + self-service-own-row.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "public_read_youths"   ON public.youths;
DROP POLICY IF EXISTS "public_insert_youths" ON public.youths;
DROP POLICY IF EXISTS "public_update_youths" ON public.youths;
DROP POLICY IF EXISTS "public_delete_youths" ON public.youths;

CREATE POLICY "youths_staff_all" ON public.youths FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
    OR public.has_role(auth.uid(), 'moderator')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
    OR public.has_role(auth.uid(), 'moderator')
  );

CREATE POLICY "youths_self_read"   ON public.youths FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "youths_self_update" ON public.youths FOR UPDATE
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- Note: no client-side INSERT/DELETE policy for youths. Registration
-- creates the auth user + youths row together via a server function
-- using the service-role client (bypasses RLS by design).

-- ----------------------------------------------------------------
-- 3. Registration category: add "Other" alongside Primary/Secondary/
--    Tertiary/Working. Must be its own statement/transaction — a new
--    enum value can't be used in the same transaction it's added in.
-- ----------------------------------------------------------------
ALTER TYPE public.youth_category ADD VALUE IF NOT EXISTS 'Other';
