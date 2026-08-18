-- ================================================================
-- Convert welfare/uniforms/formation/mission staff-write policies to
-- the generic can_access() engine, so custom roles get real,
-- independently-enforced create/edit/delete access there too —
-- matching the conversion already done for youths/events/leaders/
-- enrollment/cusa in 20260817000005.
--
-- Correction from an earlier draft of this migration: welfare_cases,
-- uniform_skus, uniform_orders, and formation_items were NOT actually
-- wide-open USING(true)/anon-granted tables — that was true only in
-- the original 20260615000000 migration, and was already superseded
-- by proper has_role()-gated policies in 20260704000000 (and, for
-- youths/events/leadership/welfare_cases/cusa_members, again by
-- 20260804000002). This migration targets the actual current policy
-- names, not the long-superseded placeholder ones.
-- ================================================================

-- ----------------------------------------------------------------
-- welfare_cases — has parish_id, no deanery_id/outstation_id.
-- No separate public/broad-read policy exists — welfare_cases_view
-- must cover staff viewing, alongside the untouched self_read/self_insert.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "welfare_cases_staff_all" ON public.welfare_cases;

CREATE POLICY "welfare_cases_view"   ON public.welfare_cases FOR SELECT
  USING (public.can_access('welfare', 'view', NULL, parish_id, NULL));
CREATE POLICY "welfare_cases_create" ON public.welfare_cases FOR INSERT
  WITH CHECK (public.can_access('welfare', 'create', NULL, parish_id, NULL));
CREATE POLICY "welfare_cases_edit"   ON public.welfare_cases FOR UPDATE
  USING (public.can_access('welfare', 'edit', NULL, parish_id, NULL))
  WITH CHECK (public.can_access('welfare', 'edit', NULL, parish_id, NULL));
CREATE POLICY "welfare_cases_delete" ON public.welfare_cases FOR DELETE
  USING (public.can_access('welfare', 'delete', NULL, parish_id, NULL));
-- welfare_cases_self_read / welfare_cases_self_insert stay untouched.

-- ----------------------------------------------------------------
-- uniform_skus — diocese-wide catalog, no org column. Its broad
-- public "uniform_skus_read_all" (USING true) stays untouched, same
-- as events_authenticated_read — only the staff write policy converts.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "uniform_skus_staff_write" ON public.uniform_skus;

CREATE POLICY "uniform_skus_create" ON public.uniform_skus FOR INSERT
  WITH CHECK (public.can_access('uniforms', 'create', NULL, NULL, NULL));
CREATE POLICY "uniform_skus_edit"   ON public.uniform_skus FOR UPDATE
  USING (public.can_access('uniforms', 'edit', NULL, NULL, NULL))
  WITH CHECK (public.can_access('uniforms', 'edit', NULL, NULL, NULL));
CREATE POLICY "uniform_skus_delete" ON public.uniform_skus FOR DELETE
  USING (public.can_access('uniforms', 'delete', NULL, NULL, NULL));

-- ----------------------------------------------------------------
-- uniform_orders — has deanery_id only, no separate broad-read policy.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "uniform_orders_staff_all" ON public.uniform_orders;

CREATE POLICY "uniform_orders_view"   ON public.uniform_orders FOR SELECT
  USING (public.can_access('uniforms', 'view', deanery_id, NULL, NULL));
CREATE POLICY "uniform_orders_create" ON public.uniform_orders FOR INSERT
  WITH CHECK (public.can_access('uniforms', 'create', deanery_id, NULL, NULL));
CREATE POLICY "uniform_orders_edit"   ON public.uniform_orders FOR UPDATE
  USING (public.can_access('uniforms', 'edit', deanery_id, NULL, NULL))
  WITH CHECK (public.can_access('uniforms', 'edit', deanery_id, NULL, NULL));
CREATE POLICY "uniform_orders_delete" ON public.uniform_orders FOR DELETE
  USING (public.can_access('uniforms', 'delete', deanery_id, NULL, NULL));

-- ----------------------------------------------------------------
-- formation_items — its "formation_items_read_all" (published=true OR
-- staff) stays untouched — visibility of published content is a
-- content-publishing rule, not a role_permissions concern. Only the
-- staff write policy converts.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "formation_items_staff_write" ON public.formation_items;

CREATE POLICY "formation_items_create" ON public.formation_items FOR INSERT
  WITH CHECK (public.can_access('formation', 'create', NULL, NULL, NULL));
CREATE POLICY "formation_items_edit"   ON public.formation_items FOR UPDATE
  USING (public.can_access('formation', 'edit', NULL, NULL, NULL))
  WITH CHECK (public.can_access('formation', 'edit', NULL, NULL, NULL));
CREATE POLICY "formation_items_delete" ON public.formation_items FOR DELETE
  USING (public.can_access('formation', 'delete', NULL, NULL, NULL));

-- ----------------------------------------------------------------
-- mission_weeks — no org column; read stays open to all (program info)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "mission_weeks_staff_write"  ON public.mission_weeks;
DROP POLICY IF EXISTS "mission_weeks_staff_update" ON public.mission_weeks;
DROP POLICY IF EXISTS "mission_weeks_staff_delete" ON public.mission_weeks;

CREATE POLICY "mission_weeks_create" ON public.mission_weeks FOR INSERT
  WITH CHECK (public.can_access('mission', 'create', NULL, NULL, NULL));
CREATE POLICY "mission_weeks_edit" ON public.mission_weeks FOR UPDATE
  USING (public.can_access('mission', 'edit', NULL, NULL, NULL))
  WITH CHECK (public.can_access('mission', 'edit', NULL, NULL, NULL));
CREATE POLICY "mission_weeks_delete" ON public.mission_weeks FOR DELETE
  USING (public.can_access('mission', 'delete', NULL, NULL, NULL));
-- mission_weeks_read_all stays untouched.

-- ----------------------------------------------------------------
-- mission_phases — no org column; read stays open to all
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "mission_phases_staff_all" ON public.mission_phases;

CREATE POLICY "mission_phases_create" ON public.mission_phases FOR INSERT
  WITH CHECK (public.can_access('mission', 'create', NULL, NULL, NULL));
CREATE POLICY "mission_phases_edit" ON public.mission_phases FOR UPDATE
  USING (public.can_access('mission', 'edit', NULL, NULL, NULL))
  WITH CHECK (public.can_access('mission', 'edit', NULL, NULL, NULL));
CREATE POLICY "mission_phases_delete" ON public.mission_phases FOR DELETE
  USING (public.can_access('mission', 'delete', NULL, NULL, NULL));
-- mission_phases_read_all stays untouched.

-- ----------------------------------------------------------------
-- mission_nominees — only source_parish_id (no deanery/outstation
-- column). A deanery-scoped role can never match a row here — an
-- inherent limitation of this table's schema, not of can_access().
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "mission_nominees_staff_all" ON public.mission_nominees;

CREATE POLICY "mission_nominees_view" ON public.mission_nominees FOR SELECT
  USING (public.can_access('mission', 'view', NULL, source_parish_id, NULL));
CREATE POLICY "mission_nominees_create" ON public.mission_nominees FOR INSERT
  WITH CHECK (public.can_access('mission', 'create', NULL, source_parish_id, NULL));
CREATE POLICY "mission_nominees_edit" ON public.mission_nominees FOR UPDATE
  USING (public.can_access('mission', 'edit', NULL, source_parish_id, NULL))
  WITH CHECK (public.can_access('mission', 'edit', NULL, source_parish_id, NULL));
CREATE POLICY "mission_nominees_delete" ON public.mission_nominees FOR DELETE
  USING (public.can_access('mission', 'delete', NULL, source_parish_id, NULL));
-- mission_nominees_self_read stays untouched.

-- ----------------------------------------------------------------
-- mission_pairings — has host_deanery_id/host_parish_id/host_outstation_id
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "mission_pairings_staff_all" ON public.mission_pairings;

CREATE POLICY "mission_pairings_view" ON public.mission_pairings FOR SELECT
  USING (public.can_access('mission', 'view', host_deanery_id, host_parish_id, host_outstation_id));
CREATE POLICY "mission_pairings_create" ON public.mission_pairings FOR INSERT
  WITH CHECK (public.can_access('mission', 'create', host_deanery_id, host_parish_id, host_outstation_id));
CREATE POLICY "mission_pairings_edit" ON public.mission_pairings FOR UPDATE
  USING (public.can_access('mission', 'edit', host_deanery_id, host_parish_id, host_outstation_id))
  WITH CHECK (public.can_access('mission', 'edit', host_deanery_id, host_parish_id, host_outstation_id));
CREATE POLICY "mission_pairings_delete" ON public.mission_pairings FOR DELETE
  USING (public.can_access('mission', 'delete', host_deanery_id, host_parish_id, host_outstation_id));
-- mission_pairings_self_read / mission_pairings_self_update_report stay untouched.
