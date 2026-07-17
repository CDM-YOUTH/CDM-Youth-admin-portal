-- Allow a youth to create/update their own enrollment application (the
-- actual Enrollment flow, built after the Phase 1 read-only dashboard
-- banner). Staff access is unaffected (enrollments_staff_all already
-- covers everything from 20260703000002).
CREATE POLICY "enrollments_self_insert" ON public.enrollments FOR INSERT
  WITH CHECK (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));

CREATE POLICY "enrollments_self_update" ON public.enrollments FOR UPDATE
  USING (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()))
  WITH CHECK (youth_id IN (SELECT id FROM public.youths WHERE auth_user_id = auth.uid()));
