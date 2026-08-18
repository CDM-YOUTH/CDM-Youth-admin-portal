-- ================================================================
-- Dynamic roles: replace the fixed app_role enum with a real table
-- a super admin can create/rename/delete rows in from the UI.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. roles table
-- ----------------------------------------------------------------
CREATE TABLE public.roles (
  name        text PRIMARY KEY CHECK (name ~ '^[a-z][a-z0-9_]*$'),
  label       text NOT NULL,
  description text,
  color       text,
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.roles TO authenticated;
GRANT ALL    ON public.roles TO service_role;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_read_all" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_admin_write" ON public.roles FOR ALL
  USING  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office'));

INSERT INTO public.roles (name, label, description, color, is_system) VALUES
  ('office',    'Office',                 'Full access — manages all modules and users',                  'danger',  true),
  ('admin',     'Admin',                  'System administrator with complete privileges',                'gold',    true),
  ('moderator', 'Moderator',              'View and edit content; cannot delete or manage users',         'info',    true),
  ('leader',    'Parish/Deanery Leader',  'Scoped access to their assigned parish or deanery',            'violet',  true),
  ('user',      'User',                   'View-only access to non-sensitive modules',                    'neutral', true);

-- Defense-in-depth: block renaming or deleting a system role even via a
-- direct DB client, not just hiding the controls in the UI.
CREATE OR REPLACE FUNCTION public.protect_system_roles()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN
      RAISE EXCEPTION 'Cannot delete a system role (%).', OLD.name;
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.is_system AND NEW.name <> OLD.name THEN
    RAISE EXCEPTION 'Cannot rename a system role (%).', OLD.name;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER roles_protect_system
  BEFORE UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_system_roles();

-- ----------------------------------------------------------------
-- 2. user_roles.role: enum -> text, FK to roles(name).
--    RESTRICT — a role in use by any user can't be deleted until
--    those users are reassigned.
-- ----------------------------------------------------------------
ALTER TABLE public.user_roles ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_fkey FOREIGN KEY (role) REFERENCES public.roles(name) ON DELETE RESTRICT;

-- ----------------------------------------------------------------
-- 3. role_permissions.role: FK to roles(name), CASCADE — deleting a
--    role cleans up its permission matrix rows. Also add `scoped`,
--    which the new generic can_access() function reads to decide
--    whether a (role, module) grant requires an org-scope match.
-- ----------------------------------------------------------------
ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_role_fkey FOREIGN KEY (role) REFERENCES public.roles(name) ON DELETE CASCADE;

ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS scoped boolean NOT NULL DEFAULT false;

-- Backfill: these are exactly the (role, module) grants 'leader' already
-- has write access to via leader_in_scope() today — preserve that behavior.
UPDATE public.role_permissions
   SET scoped = true
 WHERE role = 'leader'
   AND module IN ('youths', 'enrollment', 'events', 'leaders', 'cusa', 'mission');

-- ----------------------------------------------------------------
-- 4. has_role(): keep the EXACT same signature (uuid, app_role) —
--    dozens of existing RLS policies across the schema resolve to
--    this specific function by OID (CREATE POLICY compiles the
--    expression against a concrete function, it doesn't late-bind
--    by name), so changing the signature would require CASCADE-
--    dropping and hand-recreating every one of them. Only the body
--    needs to change, to compare against user_roles.role now that
--    it's text instead of the app_role enum. CREATE OR REPLACE with
--    an unchanged signature keeps every existing policy intact.
--    The app_role enum itself is kept (not dropped) purely as a
--    typo-guard for this parameter — every real call site only ever
--    passes literal, enum-valid role names ('admin', 'office', etc);
--    nothing needs to call has_role() with an arbitrary custom role.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role::text
  )
$$;
