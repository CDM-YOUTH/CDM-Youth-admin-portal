-- ================================================================
-- Leader role: module permissions + org-scoped write access.
-- Runs after 20260817000000 (enum value committed) and
-- 20260817000001 (profiles.outstation_id exists).
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Fix pre-existing bug: the "leaders" module (/admin/leaders) was
--    never added to role_permissions for any of the original roles.
-- ----------------------------------------------------------------
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
('office',    'leaders', true,  true,  true,  true ),
('admin',     'leaders', true,  true,  true,  true ),
('moderator', 'leaders', true,  true,  true,  false),
('user',      'leaders', false, false, false, false)
ON CONFLICT (role, module) DO NOTHING;

-- ----------------------------------------------------------------
-- 2. Seed role_permissions for the new 'leader' role across all
--    13 modules. Scoped operational access; no delete, no
--    users/settings/reports/welfare/uniforms.
-- ----------------------------------------------------------------
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
('leader', 'dashboard',   true,  false, false, false),
('leader', 'youths',      true,  true,  true,  false),
('leader', 'enrollment',  true,  true,  true,  false),
('leader', 'events',      true,  true,  true,  false),
('leader', 'leaders',     true,  true,  true,  false),
('leader', 'cusa',        true,  true,  true,  false),
('leader', 'mission',     true,  true,  true,  false),
('leader', 'formation',   true,  false, false, false),
('leader', 'welfare',     false, false, false, false),
('leader', 'uniforms',    false, false, false, false),
('leader', 'reports',     false, false, false, false),
('leader', 'users',       false, false, false, false),
('leader', 'settings',    false, false, false, false)
ON CONFLICT (role, module) DO NOTHING;

-- ----------------------------------------------------------------
-- 3. Scope-check helper for 'leader' RLS write policies.
--    A leader with no assigned deanery/parish (diocese-wide) is
--    unrestricted — same null-means-unrestricted convention
--    applyCallerScope() already uses server-side.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leader_in_scope(_row_deanery_id uuid, _row_parish_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND public.has_role(auth.uid(), 'leader')
      AND (p.deanery_id IS NULL OR p.deanery_id = _row_deanery_id)
      AND (p.parish_id  IS NULL OR p.parish_id  = _row_parish_id)
  )
$$;

-- ----------------------------------------------------------------
-- 4. Extend write RLS to grant scope-checked access to 'leader',
--    alongside (not replacing) the existing blanket
--    admin/office/moderator clause.
-- ----------------------------------------------------------------

-- youths
DROP POLICY IF EXISTS "youths_staff_all" ON public.youths;
CREATE POLICY "youths_staff_all" ON public.youths FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.leader_in_scope(deanery_id, parish_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.leader_in_scope(deanery_id, parish_id)
  );

-- events
DROP POLICY IF EXISTS "events_staff_write" ON public.events;
CREATE POLICY "events_staff_write" ON public.events FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.leader_in_scope(deanery_id, parish_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.leader_in_scope(deanery_id, parish_id)
  );

-- youth_leadership_roles ("Leaders")
DROP POLICY IF EXISTS "leadership_staff_all" ON public.youth_leadership_roles;
CREATE POLICY "leadership_staff_all" ON public.youth_leadership_roles FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.leader_in_scope(deanery_id, parish_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.leader_in_scope(deanery_id, parish_id)
  );

-- enrollments — no own org column, scope-check via the linked youth
DROP POLICY IF EXISTS "enrollments_staff_all" ON public.enrollments;
CREATE POLICY "enrollments_staff_all" ON public.enrollments FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
    OR public.has_role(auth.uid(), 'moderator')
    OR EXISTS (
      SELECT 1 FROM public.youths y
      WHERE y.id = enrollments.youth_id
        AND public.leader_in_scope(y.deanery_id, y.parish_id)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
    OR public.has_role(auth.uid(), 'moderator')
    OR EXISTS (
      SELECT 1 FROM public.youths y
      WHERE y.id = enrollments.youth_id
        AND public.leader_in_scope(y.deanery_id, y.parish_id)
    )
  );

-- cusa_members — no own org column, scope-check via the linked youth
DROP POLICY IF EXISTS "cusa_members_staff_all" ON public.cusa_members;
CREATE POLICY "cusa_members_staff_all" ON public.cusa_members FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
    OR public.has_role(auth.uid(), 'moderator')
    OR EXISTS (
      SELECT 1 FROM public.youths y
      WHERE y.id = cusa_members.youth_id
        AND public.leader_in_scope(y.deanery_id, y.parish_id)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
    OR public.has_role(auth.uid(), 'moderator')
    OR EXISTS (
      SELECT 1 FROM public.youths y
      WHERE y.id = cusa_members.youth_id
        AND public.leader_in_scope(y.deanery_id, y.parish_id)
    )
  );

-- Note: welfare_cases / uniform_* / formation tables are intentionally
-- untouched — 'leader' has no write access there per the permission matrix above.
