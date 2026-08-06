-- ================================================================
-- Security Hardening
--
-- 1. Revoke anon execute from all analytics RPC functions
--    (dashboard data must be authenticated-only)
-- 2. Drop permissive "public_*" USING (true) policies that were
--    created as placeholders in the initial migration and were never
--    replaced on: youths, cusa_members, events, event sub-tables,
--    youth_leadership_roles
-- 3. Drop the old "wc_*" open policies on welfare_cases
--    (superseded by welfare_cases_staff_all / _self_* in 20260704)
-- 4. Add proper staff-scoped policies for events and
--    youth_leadership_roles (the other tables already have them)
-- ================================================================


-- ----------------------------------------------------------------
-- 1. Analytics RPCs: authenticated only
-- ----------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.get_analytics_summary   FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_youth_breakdown     FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_enrollment_breakdown FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_cusa_breakdown      FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_leader_breakdown    FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_welfare_breakdown   FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_event_breakdown     FROM anon;


-- ----------------------------------------------------------------
-- 2. youths — drop old open policies (proper ones added in 20260703)
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "public_read_youths"   ON public.youths;
DROP POLICY IF EXISTS "public_insert_youths" ON public.youths;
DROP POLICY IF EXISTS "public_update_youths" ON public.youths;
DROP POLICY IF EXISTS "public_delete_youths" ON public.youths;


-- ----------------------------------------------------------------
-- 3. cusa_members — drop old open policies (proper ones in 20260704)
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "public_read_cusa_members"   ON public.cusa_members;
DROP POLICY IF EXISTS "public_insert_cusa_members" ON public.cusa_members;
DROP POLICY IF EXISTS "public_update_cusa_members" ON public.cusa_members;
DROP POLICY IF EXISTS "public_delete_cusa_members" ON public.cusa_members;


-- ----------------------------------------------------------------
-- 4. welfare_cases — drop old open policies (proper ones in 20260704)
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "wc_read"   ON public.welfare_cases;
DROP POLICY IF EXISTS "wc_insert" ON public.welfare_cases;
DROP POLICY IF EXISTS "wc_update" ON public.welfare_cases;
DROP POLICY IF EXISTS "wc_delete" ON public.welfare_cases;


-- ----------------------------------------------------------------
-- 5. events — drop open policies, add staff-scoped + public read
--    Events are readable by any authenticated user (youth portal
--    shows upcoming events). Only staff may create/edit/delete.
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "public_read_events"   ON public.events;
DROP POLICY IF EXISTS "public_insert_events" ON public.events;
DROP POLICY IF EXISTS "public_update_events" ON public.events;
DROP POLICY IF EXISTS "public_delete_events" ON public.events;

CREATE POLICY "events_authenticated_read" ON public.events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "events_staff_write" ON public.events FOR ALL
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


-- ----------------------------------------------------------------
-- 6. Event sub-tables: tighten but keep readable by authenticated
--    (event checkins, duties, registrations needed by youth portal)
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "public_read_event_program_items"    ON public.event_program_items;
DROP POLICY IF EXISTS "public_insert_event_program_items"  ON public.event_program_items;
DROP POLICY IF EXISTS "public_update_event_program_items"  ON public.event_program_items;
DROP POLICY IF EXISTS "public_delete_event_program_items"  ON public.event_program_items;

CREATE POLICY "epi_authenticated_read" ON public.event_program_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "epi_staff_write" ON public.event_program_items FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "public_read_event_duty_categories"    ON public.event_duty_categories;
DROP POLICY IF EXISTS "public_insert_event_duty_categories"  ON public.event_duty_categories;
DROP POLICY IF EXISTS "public_update_event_duty_categories"  ON public.event_duty_categories;
DROP POLICY IF EXISTS "public_delete_event_duty_categories"  ON public.event_duty_categories;

CREATE POLICY "edc_authenticated_read" ON public.event_duty_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "edc_staff_write" ON public.event_duty_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "public_read_event_duties"    ON public.event_duties;
DROP POLICY IF EXISTS "public_insert_event_duties"  ON public.event_duties;
DROP POLICY IF EXISTS "public_update_event_duties"  ON public.event_duties;
DROP POLICY IF EXISTS "public_delete_event_duties"  ON public.event_duties;

CREATE POLICY "ed_authenticated_read" ON public.event_duties
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ed_staff_write" ON public.event_duties FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "public_read_event_duty_assignees"    ON public.event_duty_assignees;
DROP POLICY IF EXISTS "public_insert_event_duty_assignees"  ON public.event_duty_assignees;
DROP POLICY IF EXISTS "public_update_event_duty_assignees"  ON public.event_duty_assignees;
DROP POLICY IF EXISTS "public_delete_event_duty_assignees"  ON public.event_duty_assignees;

CREATE POLICY "eda_authenticated_read" ON public.event_duty_assignees
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "eda_staff_write" ON public.event_duty_assignees FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "public_read_event_checkins"    ON public.event_checkins;
DROP POLICY IF EXISTS "public_insert_event_checkins"  ON public.event_checkins;
DROP POLICY IF EXISTS "public_update_event_checkins"  ON public.event_checkins;
DROP POLICY IF EXISTS "public_delete_event_checkins"  ON public.event_checkins;

CREATE POLICY "ec_staff_all" ON public.event_checkins FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'));

-- Youth can check in themselves (self-insert) and read their own checkins
CREATE POLICY "ec_self_read" ON public.event_checkins FOR SELECT
  USING (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));

CREATE POLICY "ec_self_insert" ON public.event_checkins FOR INSERT
  WITH CHECK (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));


-- ----------------------------------------------------------------
-- 7. youth_leadership_roles — drop open policies, add staff-scoped
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "leadership_read"   ON public.youth_leadership_roles;
DROP POLICY IF EXISTS "leadership_insert" ON public.youth_leadership_roles;
DROP POLICY IF EXISTS "leadership_update" ON public.youth_leadership_roles;
DROP POLICY IF EXISTS "leadership_delete" ON public.youth_leadership_roles;

CREATE POLICY "leadership_staff_all" ON public.youth_leadership_roles FOR ALL
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

-- Authenticated users can read leadership roles (needed for org directory)
CREATE POLICY "leadership_authenticated_read" ON public.youth_leadership_roles
  FOR SELECT TO authenticated USING (true);
