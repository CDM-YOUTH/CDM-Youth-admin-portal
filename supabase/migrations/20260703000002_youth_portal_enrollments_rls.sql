-- ================================================================
-- Youth Portal — enrollments read access for the Home dashboard
--
-- The Home dashboard shows the signed-in youth's own enrollment status
-- for the current year. `enrollments` still had the placeholder
-- "public_*" policies (`using (true)`) from the admin-only era, which
-- would let any authenticated youth read (and write) every member's
-- payment status. Tighten it the same way youths was tightened:
-- staff keep full access, a youth can only read their own rows.
-- Self-service enrollment creation/payment lands in a later phase
-- (M-Pesa integration), so no self INSERT/UPDATE policy yet.
-- ================================================================

DROP POLICY IF EXISTS "public_read_enrollments"   ON public.enrollments;
DROP POLICY IF EXISTS "public_insert_enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "public_update_enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "public_delete_enrollments" ON public.enrollments;

CREATE POLICY "enrollments_staff_all" ON public.enrollments FOR ALL
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

CREATE POLICY "enrollments_self_read" ON public.enrollments FOR SELECT
  USING (
    youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid())
  );
