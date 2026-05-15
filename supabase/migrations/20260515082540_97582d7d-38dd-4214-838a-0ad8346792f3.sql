
ALTER TABLE public.youths ADD COLUMN IF NOT EXISTS passport_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('passports', 'passports', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "passports_public_read" ON storage.objects;
CREATE POLICY "passports_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'passports');

DROP POLICY IF EXISTS "passports_public_insert" ON storage.objects;
CREATE POLICY "passports_public_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'passports');

DROP POLICY IF EXISTS "passports_public_update" ON storage.objects;
CREATE POLICY "passports_public_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'passports');

DROP POLICY IF EXISTS "passports_public_delete" ON storage.objects;
CREATE POLICY "passports_public_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'passports');
