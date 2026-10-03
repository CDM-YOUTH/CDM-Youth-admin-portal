-- =========================================================
-- Finance Module Role Permissions
-- Adds 'finances' module to all existing roles
-- =========================================================

INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
  -- admin: full access
  ('admin', 'finances', true, true, true, true),

  -- office: full access (same as admin for office staff)
  ('office', 'finances', true, true, true, true),

  -- moderator: view, create, edit assessments and payments (no delete)
  ('moderator', 'finances', true, true, true, false),

  -- user: view only (can view financial summaries but cannot record payments)
  ('user', 'finances', true, false, false, false)
ON CONFLICT (role, module) DO NOTHING;
