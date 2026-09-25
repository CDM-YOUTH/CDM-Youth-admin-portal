-- =========================================================
-- Add Patronage Module to Role Permissions
-- =========================================================

INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
('admin',     'patronage', true,  true,  true,  true),
('office',    'patronage', true,  true,  true,  true),
('moderator', 'patronage', true,  true,  true,  false),
('leader',    'patronage', false, false, false, false),
('user',      'patronage', false, false, false, false)
ON CONFLICT (role, module) DO NOTHING;
