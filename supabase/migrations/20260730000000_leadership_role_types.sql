-- ================================================================
-- Leadership Role Types
--
-- Replaces the free-text `role` column in youth_leadership_roles
-- with a UUID foreign key into a managed reference table, matching
-- the same pattern used for deaneries / parishes / outstations.
-- ================================================================

-- 1. Reference table
CREATE TABLE public.leadership_role_types (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leadership_role_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_types_select" ON public.leadership_role_types FOR SELECT USING (true);
CREATE POLICY "role_types_insert" ON public.leadership_role_types FOR INSERT WITH CHECK (true);
CREATE POLICY "role_types_update" ON public.leadership_role_types FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "role_types_delete" ON public.leadership_role_types FOR DELETE USING (true);

-- 2. Seed the standard roles
INSERT INTO public.leadership_role_types (name) VALUES
  ('Coordinator'),
  ('Vice Coordinator'),
  ('Secretary'),
  ('Vice Secretary'),
  ('Treasurer'),
  ('Organising Secretary'),
  ('Discipline Master/Mistress'),
  ('Liturgist'),
  ('Choir Master')
ON CONFLICT (name) DO NOTHING;

-- 3. Add role_id column (nullable initially so existing rows are preserved)
ALTER TABLE public.youth_leadership_roles
  ADD COLUMN role_id uuid REFERENCES public.leadership_role_types(id) ON DELETE RESTRICT;

-- 4. Migrate existing rows whose role text matches a standard role
UPDATE public.youth_leadership_roles ylr
SET role_id = rt.id
FROM public.leadership_role_types rt
WHERE ylr.role = rt.name;

-- 5. For any remaining rows with custom role names, auto-create a role type entry
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT role
    FROM public.youth_leadership_roles
    WHERE role_id IS NULL AND role IS NOT NULL AND role <> ''
  LOOP
    INSERT INTO public.leadership_role_types (name) VALUES (r.role)
    ON CONFLICT (name) DO NOTHING;

    UPDATE public.youth_leadership_roles
    SET role_id = (SELECT id FROM public.leadership_role_types WHERE name = r.role)
    WHERE role = r.role AND role_id IS NULL;
  END LOOP;
END $$;

-- 6. Enforce NOT NULL now that all rows have been migrated
ALTER TABLE public.youth_leadership_roles
  ALTER COLUMN role_id SET NOT NULL;

-- 7. Drop the old unique index (it references the `role` text column)
DROP INDEX IF EXISTS leadership_no_duplicate_active;

-- 8. Rebuild the unique index using role_id
CREATE UNIQUE INDEX leadership_no_duplicate_active
  ON public.youth_leadership_roles (
    level,
    role_id,
    COALESCE(deanery_id::text,    ''),
    COALESCE(parish_id::text,     ''),
    COALESCE(outstation_id::text, '')
  )
  WHERE end_date IS NULL;

-- 9. Drop the old free-text role column
ALTER TABLE public.youth_leadership_roles DROP COLUMN role;
