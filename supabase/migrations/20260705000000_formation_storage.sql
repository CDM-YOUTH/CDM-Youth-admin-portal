-- ================================================================
-- Formation Library — file storage
--
-- Lets admin staff upload real PDFs/audio/video/images for a
-- formation_items row instead of pasting an already-hosted URL, and
-- lets the Youth Portal display them. Public read (published content
-- is meant to be viewed by any youth), staff-only write — mirrors the
-- existing "passports" bucket pattern from 20260515082540, except
-- writes are restricted to staff since this isn't self-service content
-- like a registration photo.
-- ================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('formation', 'formation', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "formation_public_read" ON storage.objects;
CREATE POLICY "formation_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'formation');

DROP POLICY IF EXISTS "formation_staff_insert" ON storage.objects;
CREATE POLICY "formation_staff_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'formation'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  );

DROP POLICY IF EXISTS "formation_staff_update" ON storage.objects;
CREATE POLICY "formation_staff_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'formation'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  );

DROP POLICY IF EXISTS "formation_staff_delete" ON storage.objects;
CREATE POLICY "formation_staff_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'formation'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  );
