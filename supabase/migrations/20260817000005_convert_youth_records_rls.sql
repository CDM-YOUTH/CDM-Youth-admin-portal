-- ================================================================
-- Convert the "youth records" domain tables' staff write policies
-- from hardcoded has_role()/leader_in_scope() OR-chains to the
-- generic can_access() engine, so any role — including ones created
-- from the UI — gets real, independently-enforced view/create/edit/
-- delete access matching exactly what the Roles tab configures.
--
-- Untouched: every *_self_*, *_authenticated_read, *_read_all policy
-- (youth-portal-facing) — none of those are staff-role-gated today
-- and none should become so here.
-- ================================================================

-- ----------------------------------------------------------------
-- youths
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "youths_staff_all" ON public.youths;

CREATE POLICY "youths_view" ON public.youths FOR SELECT
  USING (public.can_access('youths', 'view', deanery_id, parish_id, outstation_id));
CREATE POLICY "youths_create" ON public.youths FOR INSERT
  WITH CHECK (public.can_access('youths', 'create', deanery_id, parish_id, outstation_id));
CREATE POLICY "youths_edit" ON public.youths FOR UPDATE
  USING (public.can_access('youths', 'edit', deanery_id, parish_id, outstation_id))
  WITH CHECK (public.can_access('youths', 'edit', deanery_id, parish_id, outstation_id));
CREATE POLICY "youths_delete" ON public.youths FOR DELETE
  USING (public.can_access('youths', 'delete', deanery_id, parish_id, outstation_id));

-- ----------------------------------------------------------------
-- events
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "events_staff_write" ON public.events;

CREATE POLICY "events_view" ON public.events FOR SELECT
  USING (public.can_access('events', 'view', deanery_id, parish_id, outstation_id));
CREATE POLICY "events_create" ON public.events FOR INSERT
  WITH CHECK (public.can_access('events', 'create', deanery_id, parish_id, outstation_id));
CREATE POLICY "events_edit" ON public.events FOR UPDATE
  USING (public.can_access('events', 'edit', deanery_id, parish_id, outstation_id))
  WITH CHECK (public.can_access('events', 'edit', deanery_id, parish_id, outstation_id));
CREATE POLICY "events_delete" ON public.events FOR DELETE
  USING (public.can_access('events', 'delete', deanery_id, parish_id, outstation_id));
-- events_authenticated_read stays untouched — any authenticated user can still read events.

-- ----------------------------------------------------------------
-- event_program_items — one hop from events (event_id)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "epi_staff_write" ON public.event_program_items;

CREATE POLICY "epi_view" ON public.event_program_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_program_items.event_id
    AND public.can_access('events', 'view', e.deanery_id, e.parish_id, e.outstation_id)));
CREATE POLICY "epi_create" ON public.event_program_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_program_items.event_id
    AND public.can_access('events', 'create', e.deanery_id, e.parish_id, e.outstation_id)));
CREATE POLICY "epi_edit" ON public.event_program_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_program_items.event_id
    AND public.can_access('events', 'edit', e.deanery_id, e.parish_id, e.outstation_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_program_items.event_id
    AND public.can_access('events', 'edit', e.deanery_id, e.parish_id, e.outstation_id)));
CREATE POLICY "epi_delete" ON public.event_program_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_program_items.event_id
    AND public.can_access('events', 'delete', e.deanery_id, e.parish_id, e.outstation_id)));

-- ----------------------------------------------------------------
-- event_duty_categories — one hop from events (event_id)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "edc_staff_write" ON public.event_duty_categories;

CREATE POLICY "edc_view" ON public.event_duty_categories FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_duty_categories.event_id
    AND public.can_access('events', 'view', e.deanery_id, e.parish_id, e.outstation_id)));
CREATE POLICY "edc_create" ON public.event_duty_categories FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_duty_categories.event_id
    AND public.can_access('events', 'create', e.deanery_id, e.parish_id, e.outstation_id)));
CREATE POLICY "edc_edit" ON public.event_duty_categories FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_duty_categories.event_id
    AND public.can_access('events', 'edit', e.deanery_id, e.parish_id, e.outstation_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_duty_categories.event_id
    AND public.can_access('events', 'edit', e.deanery_id, e.parish_id, e.outstation_id)));
CREATE POLICY "edc_delete" ON public.event_duty_categories FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_duty_categories.event_id
    AND public.can_access('events', 'delete', e.deanery_id, e.parish_id, e.outstation_id)));

-- ----------------------------------------------------------------
-- event_duties — two hops (category_id -> event_duty_categories.event_id -> events)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "ed_staff_write" ON public.event_duties;

CREATE POLICY "ed_view" ON public.event_duties FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.event_duty_categories c JOIN public.events e ON e.id = c.event_id
    WHERE c.id = event_duties.category_id
      AND public.can_access('events', 'view', e.deanery_id, e.parish_id, e.outstation_id)));
CREATE POLICY "ed_create" ON public.event_duties FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.event_duty_categories c JOIN public.events e ON e.id = c.event_id
    WHERE c.id = event_duties.category_id
      AND public.can_access('events', 'create', e.deanery_id, e.parish_id, e.outstation_id)));
CREATE POLICY "ed_edit" ON public.event_duties FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.event_duty_categories c JOIN public.events e ON e.id = c.event_id
    WHERE c.id = event_duties.category_id
      AND public.can_access('events', 'edit', e.deanery_id, e.parish_id, e.outstation_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.event_duty_categories c JOIN public.events e ON e.id = c.event_id
    WHERE c.id = event_duties.category_id
      AND public.can_access('events', 'edit', e.deanery_id, e.parish_id, e.outstation_id)));
CREATE POLICY "ed_delete" ON public.event_duties FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.event_duty_categories c JOIN public.events e ON e.id = c.event_id
    WHERE c.id = event_duties.category_id
      AND public.can_access('events', 'delete', e.deanery_id, e.parish_id, e.outstation_id)));

-- ----------------------------------------------------------------
-- event_duty_assignees — carries its own deanery_id/parish_id (no outstation_id)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "eda_staff_write" ON public.event_duty_assignees;

CREATE POLICY "eda_view" ON public.event_duty_assignees FOR SELECT
  USING (public.can_access('events', 'view', deanery_id, parish_id, NULL));
CREATE POLICY "eda_create" ON public.event_duty_assignees FOR INSERT
  WITH CHECK (public.can_access('events', 'create', deanery_id, parish_id, NULL));
CREATE POLICY "eda_edit" ON public.event_duty_assignees FOR UPDATE
  USING (public.can_access('events', 'edit', deanery_id, parish_id, NULL))
  WITH CHECK (public.can_access('events', 'edit', deanery_id, parish_id, NULL));
CREATE POLICY "eda_delete" ON public.event_duty_assignees FOR DELETE
  USING (public.can_access('events', 'delete', deanery_id, parish_id, NULL));

-- ----------------------------------------------------------------
-- event_checkins — one hop from events (event_id); no separate
-- authenticated_read policy exists for this table, so "view" must
-- be granted here for staff (self_read/self_insert stay untouched).
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "ec_staff_all" ON public.event_checkins;

CREATE POLICY "ec_view" ON public.event_checkins FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_checkins.event_id
    AND public.can_access('events', 'view', e.deanery_id, e.parish_id, e.outstation_id)));
CREATE POLICY "ec_create" ON public.event_checkins FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_checkins.event_id
    AND public.can_access('events', 'create', e.deanery_id, e.parish_id, e.outstation_id)));
CREATE POLICY "ec_edit" ON public.event_checkins FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_checkins.event_id
    AND public.can_access('events', 'edit', e.deanery_id, e.parish_id, e.outstation_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_checkins.event_id
    AND public.can_access('events', 'edit', e.deanery_id, e.parish_id, e.outstation_id)));
CREATE POLICY "ec_delete" ON public.event_checkins FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_checkins.event_id
    AND public.can_access('events', 'delete', e.deanery_id, e.parish_id, e.outstation_id)));

-- ----------------------------------------------------------------
-- youth_leadership_roles ("Leaders")
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "leadership_staff_all" ON public.youth_leadership_roles;

CREATE POLICY "leadership_view" ON public.youth_leadership_roles FOR SELECT
  USING (public.can_access('leaders', 'view', deanery_id, parish_id, outstation_id));
CREATE POLICY "leadership_create" ON public.youth_leadership_roles FOR INSERT
  WITH CHECK (public.can_access('leaders', 'create', deanery_id, parish_id, outstation_id));
CREATE POLICY "leadership_edit" ON public.youth_leadership_roles FOR UPDATE
  USING (public.can_access('leaders', 'edit', deanery_id, parish_id, outstation_id))
  WITH CHECK (public.can_access('leaders', 'edit', deanery_id, parish_id, outstation_id));
CREATE POLICY "leadership_delete" ON public.youth_leadership_roles FOR DELETE
  USING (public.can_access('leaders', 'delete', deanery_id, parish_id, outstation_id));
-- leadership_authenticated_read stays untouched.

-- ----------------------------------------------------------------
-- enrollments — no own org column, scope-check via the linked youth
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "enrollments_staff_all" ON public.enrollments;

CREATE POLICY "enrollments_view" ON public.enrollments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.youths y WHERE y.id = enrollments.youth_id
    AND public.can_access('enrollment', 'view', y.deanery_id, y.parish_id, y.outstation_id)));
CREATE POLICY "enrollments_create" ON public.enrollments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.youths y WHERE y.id = enrollments.youth_id
    AND public.can_access('enrollment', 'create', y.deanery_id, y.parish_id, y.outstation_id)));
CREATE POLICY "enrollments_edit" ON public.enrollments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.youths y WHERE y.id = enrollments.youth_id
    AND public.can_access('enrollment', 'edit', y.deanery_id, y.parish_id, y.outstation_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.youths y WHERE y.id = enrollments.youth_id
    AND public.can_access('enrollment', 'edit', y.deanery_id, y.parish_id, y.outstation_id)));
CREATE POLICY "enrollments_delete" ON public.enrollments FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.youths y WHERE y.id = enrollments.youth_id
    AND public.can_access('enrollment', 'delete', y.deanery_id, y.parish_id, y.outstation_id)));

-- ----------------------------------------------------------------
-- cusa_members — no own org column, scope-check via the linked youth
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "cusa_members_staff_all" ON public.cusa_members;

CREATE POLICY "cusa_members_view" ON public.cusa_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.youths y WHERE y.id = cusa_members.youth_id
    AND public.can_access('cusa', 'view', y.deanery_id, y.parish_id, y.outstation_id)));
CREATE POLICY "cusa_members_create" ON public.cusa_members FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.youths y WHERE y.id = cusa_members.youth_id
    AND public.can_access('cusa', 'create', y.deanery_id, y.parish_id, y.outstation_id)));
CREATE POLICY "cusa_members_edit" ON public.cusa_members FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.youths y WHERE y.id = cusa_members.youth_id
    AND public.can_access('cusa', 'edit', y.deanery_id, y.parish_id, y.outstation_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.youths y WHERE y.id = cusa_members.youth_id
    AND public.can_access('cusa', 'edit', y.deanery_id, y.parish_id, y.outstation_id)));
CREATE POLICY "cusa_members_delete" ON public.cusa_members FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.youths y WHERE y.id = cusa_members.youth_id
    AND public.can_access('cusa', 'delete', y.deanery_id, y.parish_id, y.outstation_id)));

-- ----------------------------------------------------------------
-- cusa_transitions — no own org column, scope-check via the linked youth
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "cusa_transitions_staff_all" ON public.cusa_transitions;

CREATE POLICY "cusa_transitions_view" ON public.cusa_transitions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.youths y WHERE y.id = cusa_transitions.youth_id
    AND public.can_access('cusa', 'view', y.deanery_id, y.parish_id, y.outstation_id)));
CREATE POLICY "cusa_transitions_create" ON public.cusa_transitions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.youths y WHERE y.id = cusa_transitions.youth_id
    AND public.can_access('cusa', 'create', y.deanery_id, y.parish_id, y.outstation_id)));
CREATE POLICY "cusa_transitions_edit" ON public.cusa_transitions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.youths y WHERE y.id = cusa_transitions.youth_id
    AND public.can_access('cusa', 'edit', y.deanery_id, y.parish_id, y.outstation_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.youths y WHERE y.id = cusa_transitions.youth_id
    AND public.can_access('cusa', 'edit', y.deanery_id, y.parish_id, y.outstation_id)));
CREATE POLICY "cusa_transitions_delete" ON public.cusa_transitions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.youths y WHERE y.id = cusa_transitions.youth_id
    AND public.can_access('cusa', 'delete', y.deanery_id, y.parish_id, y.outstation_id)));

-- ----------------------------------------------------------------
-- leader_in_scope() is now unused — every policy that called it has
-- just been replaced by the generic can_access() above.
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.leader_in_scope(uuid, uuid);
