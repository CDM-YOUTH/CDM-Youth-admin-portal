-- =========================================================
-- Finance Module Role Permissions
-- Adds 'finances' module to all existing roles
-- =========================================================

INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
  -- admin: full access to ledger & config
  ('admin', 'finances', true, true, true, true),
  ('admin', 'finances-config', true, true, true, true),

  -- office: full access to ledger & config
  ('office', 'finances', true, true, true, true),
  ('office', 'finances-config', true, true, true, true),

  -- moderator: ledger write access, config read-only
  ('moderator', 'finances', true, true, true, false),
  ('moderator', 'finances-config', true, false, false, false),

  -- user: view only
  ('user', 'finances', true, false, false, false),
  ('user', 'finances-config', false, false, false, false)
ON CONFLICT (role, module) DO NOTHING;
