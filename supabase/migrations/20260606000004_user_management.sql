-- ================================================================
-- User management: add email to profiles, role_permissions table
-- ================================================================

-- Add email to profiles so the users list can show it
-- without needing service-role access to auth.users
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Update the handle_new_user trigger to also copy the email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    email     = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);
  RETURN NEW;
END;
$$;

-- Backfill email for any existing profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- ----------------------------------------------------------------
-- role_permissions: one row per (role, module) pair.
-- Uses text for role to avoid the app_role enum transaction issue.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  role       text    NOT NULL,
  module     text    NOT NULL,
  can_view   boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit   boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  UNIQUE (role, module)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT SELECT                          ON public.role_permissions TO anon;
GRANT ALL                             ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_read_all"   ON public.role_permissions FOR SELECT USING (true);
CREATE POLICY "rp_admin_write" ON public.role_permissions FOR ALL
  USING  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office'));

-- ----------------------------------------------------------------
-- Default permissions seed
-- ----------------------------------------------------------------
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
-- office: full access to everything
('office', 'dashboard',   true,  false, false, false),
('office', 'youths',      true,  true,  true,  true ),
('office', 'enrollment',  true,  true,  true,  true ),
('office', 'events',      true,  true,  true,  true ),
('office', 'mission',     true,  true,  true,  true ),
('office', 'cusa',        true,  true,  true,  true ),
('office', 'formation',   true,  true,  true,  true ),
('office', 'welfare',     true,  true,  true,  true ),
('office', 'uniforms',    true,  true,  true,  true ),
('office', 'reports',     true,  false, false, false),
('office', 'users',       true,  true,  true,  false),
('office', 'settings',    true,  false, true,  false),

-- admin: full access including delete users and settings
('admin', 'dashboard',   true,  false, false, false),
('admin', 'youths',      true,  true,  true,  true ),
('admin', 'enrollment',  true,  true,  true,  true ),
('admin', 'events',      true,  true,  true,  true ),
('admin', 'mission',     true,  true,  true,  true ),
('admin', 'cusa',        true,  true,  true,  true ),
('admin', 'formation',   true,  true,  true,  true ),
('admin', 'welfare',     true,  true,  true,  true ),
('admin', 'uniforms',    true,  true,  true,  true ),
('admin', 'reports',     true,  true,  true,  true ),
('admin', 'users',       true,  true,  true,  true ),
('admin', 'settings',    true,  true,  true,  true ),

-- moderator: view + create + edit most modules, no delete, no user management
('moderator', 'dashboard',   true,  false, false, false),
('moderator', 'youths',      true,  true,  true,  false),
('moderator', 'enrollment',  true,  true,  true,  false),
('moderator', 'events',      true,  true,  true,  false),
('moderator', 'mission',     true,  false, true,  false),
('moderator', 'cusa',        true,  true,  true,  false),
('moderator', 'formation',   true,  true,  true,  false),
('moderator', 'welfare',     true,  true,  true,  false),
('moderator', 'uniforms',    true,  false, true,  false),
('moderator', 'reports',     true,  false, false, false),
('moderator', 'users',       false, false, false, false),
('moderator', 'settings',    false, false, false, false),

-- user: view only, restricted modules
('user', 'dashboard',   true,  false, false, false),
('user', 'youths',      true,  false, false, false),
('user', 'enrollment',  true,  false, false, false),
('user', 'events',      true,  false, false, false),
('user', 'mission',     false, false, false, false),
('user', 'cusa',        true,  false, false, false),
('user', 'formation',   true,  false, false, false),
('user', 'welfare',     false, false, false, false),
('user', 'uniforms',    false, false, false, false),
('user', 'reports',     false, false, false, false),
('user', 'users',       false, false, false, false),
('user', 'settings',    false, false, false, false)
ON CONFLICT (role, module) DO NOTHING;
