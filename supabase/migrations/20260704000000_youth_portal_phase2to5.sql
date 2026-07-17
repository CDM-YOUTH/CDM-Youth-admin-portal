-- ================================================================
-- Youth Portal Phases 2-5 — RLS tightening + schema additions
--
-- These tables still carry the original admin-only "public_*" /
-- USING (true) placeholder policies. Now that youths interact with
-- them directly through the portal, tighten each to: staff keep full
-- access (has_role admin/office/moderator), a youth can only touch
-- rows tied to their own youths.id, and purely back-office tables
-- (uniform_orders, uniform_stock_entries) drop public access entirely.
-- ================================================================

-- ----------------------------------------------------------------
-- event_registrations — self RSVP
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "public_read_event_registrations"   ON public.event_registrations;
DROP POLICY IF EXISTS "public_insert_event_registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "public_update_event_registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "public_delete_event_registrations" ON public.event_registrations;

CREATE POLICY "event_registrations_staff_all" ON public.event_registrations FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "event_registrations_self_read" ON public.event_registrations FOR SELECT
  USING (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));

CREATE POLICY "event_registrations_self_insert" ON public.event_registrations FOR INSERT
  WITH CHECK (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));

CREATE POLICY "event_registrations_self_delete" ON public.event_registrations FOR DELETE
  USING (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));

-- ----------------------------------------------------------------
-- mission_weeks / mission_phases — public read (program info), staff write
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "public_read_mission_weeks"   ON public.mission_weeks;
DROP POLICY IF EXISTS "public_insert_mission_weeks" ON public.mission_weeks;
DROP POLICY IF EXISTS "public_update_mission_weeks" ON public.mission_weeks;
DROP POLICY IF EXISTS "public_delete_mission_weeks" ON public.mission_weeks;
CREATE POLICY "mission_weeks_read_all" ON public.mission_weeks FOR SELECT USING (true);
CREATE POLICY "mission_weeks_staff_write" ON public.mission_weeks FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "mission_weeks_staff_update" ON public.mission_weeks FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "mission_weeks_staff_delete" ON public.mission_weeks FOR DELETE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office'));

DROP POLICY IF EXISTS "public_read_mission_phases"   ON public.mission_phases;
DROP POLICY IF EXISTS "public_insert_mission_phases" ON public.mission_phases;
DROP POLICY IF EXISTS "public_update_mission_phases" ON public.mission_phases;
DROP POLICY IF EXISTS "public_delete_mission_phases" ON public.mission_phases;
CREATE POLICY "mission_phases_read_all" ON public.mission_phases FOR SELECT USING (true);
CREATE POLICY "mission_phases_staff_all" ON public.mission_phases FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));

-- ----------------------------------------------------------------
-- mission_nominees / mission_pairings — self read own, staff full
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "public_read_mission_nominees"   ON public.mission_nominees;
DROP POLICY IF EXISTS "public_insert_mission_nominees" ON public.mission_nominees;
DROP POLICY IF EXISTS "public_update_mission_nominees" ON public.mission_nominees;
DROP POLICY IF EXISTS "public_delete_mission_nominees" ON public.mission_nominees;
CREATE POLICY "mission_nominees_staff_all" ON public.mission_nominees FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "mission_nominees_self_read" ON public.mission_nominees FOR SELECT
  USING (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "public_read_mission_pairings"   ON public.mission_pairings;
DROP POLICY IF EXISTS "public_insert_mission_pairings" ON public.mission_pairings;
DROP POLICY IF EXISTS "public_update_mission_pairings" ON public.mission_pairings;
DROP POLICY IF EXISTS "public_delete_mission_pairings" ON public.mission_pairings;
CREATE POLICY "mission_pairings_staff_all" ON public.mission_pairings FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "mission_pairings_self_read" ON public.mission_pairings FOR SELECT
  USING (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));
CREATE POLICY "mission_pairings_self_update_report" ON public.mission_pairings FOR UPDATE
  USING (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()))
  WITH CHECK (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));

-- ----------------------------------------------------------------
-- cusa_members — self read/update own, staff full
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "public_read_cusa_members"   ON public.cusa_members;
DROP POLICY IF EXISTS "public_insert_cusa_members" ON public.cusa_members;
DROP POLICY IF EXISTS "public_update_cusa_members" ON public.cusa_members;
DROP POLICY IF EXISTS "public_delete_cusa_members" ON public.cusa_members;
CREATE POLICY "cusa_members_staff_all" ON public.cusa_members FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "cusa_members_self_read" ON public.cusa_members FOR SELECT
  USING (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));
CREATE POLICY "cusa_members_self_update" ON public.cusa_members FOR UPDATE
  USING (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()))
  WITH CHECK (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));
CREATE POLICY "cusa_members_self_insert" ON public.cusa_members FOR INSERT
  WITH CHECK (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));

-- ----------------------------------------------------------------
-- cusa_transitions — self read own, staff full (staff process transitions)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "public_read_cusa_transitions"   ON public.cusa_transitions;
DROP POLICY IF EXISTS "public_insert_cusa_transitions" ON public.cusa_transitions;
DROP POLICY IF EXISTS "public_update_cusa_transitions" ON public.cusa_transitions;
DROP POLICY IF EXISTS "public_delete_cusa_transitions" ON public.cusa_transitions;
CREATE POLICY "cusa_transitions_staff_all" ON public.cusa_transitions FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "cusa_transitions_self_read" ON public.cusa_transitions FOR SELECT
  USING (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));

-- ----------------------------------------------------------------
-- welfare_cases — privacy sensitive: self insert + read own ONLY, staff full
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "wc_read"   ON public.welfare_cases;
DROP POLICY IF EXISTS "wc_insert" ON public.welfare_cases;
DROP POLICY IF EXISTS "wc_update" ON public.welfare_cases;
DROP POLICY IF EXISTS "wc_delete" ON public.welfare_cases;
CREATE POLICY "welfare_cases_staff_all" ON public.welfare_cases FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "welfare_cases_self_read" ON public.welfare_cases FOR SELECT
  USING (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));
CREATE POLICY "welfare_cases_self_insert" ON public.welfare_cases FOR INSERT
  WITH CHECK (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));

-- ----------------------------------------------------------------
-- uniform_skus — public catalog read, staff-only write
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "sku_read"   ON public.uniform_skus;
DROP POLICY IF EXISTS "sku_insert" ON public.uniform_skus;
DROP POLICY IF EXISTS "sku_update" ON public.uniform_skus;
DROP POLICY IF EXISTS "sku_delete" ON public.uniform_skus;
CREATE POLICY "uniform_skus_read_all" ON public.uniform_skus FOR SELECT USING (true);
CREATE POLICY "uniform_skus_staff_write" ON public.uniform_skus FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));

-- ----------------------------------------------------------------
-- uniform_orders / uniform_stock_entries — pure back-office, staff only
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "uo_read"   ON public.uniform_orders;
DROP POLICY IF EXISTS "uo_insert" ON public.uniform_orders;
DROP POLICY IF EXISTS "uo_update" ON public.uniform_orders;
DROP POLICY IF EXISTS "uo_delete" ON public.uniform_orders;
CREATE POLICY "uniform_orders_staff_all" ON public.uniform_orders FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "use_read"   ON public.uniform_stock_entries;
DROP POLICY IF EXISTS "use_insert" ON public.uniform_stock_entries;
DROP POLICY IF EXISTS "use_delete" ON public.uniform_stock_entries;
CREATE POLICY "uniform_stock_entries_staff_all" ON public.uniform_stock_entries FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));

-- ----------------------------------------------------------------
-- uniform_sales — add self-service ordering columns + RLS
-- ----------------------------------------------------------------
ALTER TABLE public.uniform_sales
  ADD COLUMN IF NOT EXISTS youth_id uuid REFERENCES public.youths(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS size text;

CREATE INDEX IF NOT EXISTS uniform_sales_youth_idx ON public.uniform_sales(youth_id);

DROP POLICY IF EXISTS "us_read"   ON public.uniform_sales;
DROP POLICY IF EXISTS "us_insert" ON public.uniform_sales;
DROP POLICY IF EXISTS "us_update" ON public.uniform_sales;
DROP POLICY IF EXISTS "us_delete" ON public.uniform_sales;
CREATE POLICY "uniform_sales_staff_all" ON public.uniform_sales FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "uniform_sales_self_read" ON public.uniform_sales FOR SELECT
  USING (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));
CREATE POLICY "uniform_sales_self_insert" ON public.uniform_sales FOR INSERT
  WITH CHECK (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));

-- ----------------------------------------------------------------
-- formation_items — public read (published content), staff-only write
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "fi_read"   ON public.formation_items;
DROP POLICY IF EXISTS "fi_insert" ON public.formation_items;
DROP POLICY IF EXISTS "fi_update" ON public.formation_items;
DROP POLICY IF EXISTS "fi_delete" ON public.formation_items;
CREATE POLICY "formation_items_read_all" ON public.formation_items FOR SELECT USING (published = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "formation_items_staff_write" ON public.formation_items FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));

-- ----------------------------------------------------------------
-- formation_bookmarks — new table, fully self-owned
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.formation_bookmarks (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  formation_id  uuid        NOT NULL REFERENCES public.formation_items(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, formation_id)
);

ALTER TABLE public.formation_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "formation_bookmarks_self_all" ON public.formation_bookmarks FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
