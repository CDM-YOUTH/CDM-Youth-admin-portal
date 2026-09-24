-- =========================================================
-- Patronage Team
-- Patrons/Patronesses serve all youth at their org level
-- Can transact on behalf of youth (orders, cases, enrollments)
-- =========================================================

-- =========================================================
-- PATRONAGE_TEAM (Patron/Patroness at org level)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.patronage_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- PERSONAL DETAILS
  name text NOT NULL,
  phone text,
  email text,
  gender public.gender NOT NULL, -- 'Male' (Patron) or 'Female' (Patroness)

  -- ORG LEVEL ASSIGNMENT (serves all youth at this level)
  level text NOT NULL CHECK (level IN ('outstation', 'parish', 'deanery', 'diocese')),
  outstation_id uuid REFERENCES public.outstations(id) ON DELETE CASCADE,
  parish_id uuid REFERENCES public.parishes(id) ON DELETE CASCADE,
  deanery_id uuid REFERENCES public.deaneries(id) ON DELETE CASCADE,

  -- TERM START
  start_date date NOT NULL DEFAULT CURRENT_DATE,

  -- AUDIT FIELDS
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- CONSTRAINT: ensure correct org FK for each level
  CONSTRAINT patronage_level_fk CHECK (
    (level = 'diocese'    AND deanery_id IS NULL AND parish_id IS NULL AND outstation_id IS NULL)
    OR (level = 'deanery' AND deanery_id IS NOT NULL AND parish_id IS NULL AND outstation_id IS NULL)
    OR (level = 'parish'  AND parish_id IS NOT NULL AND outstation_id IS NULL)
    OR (level = 'outstation' AND outstation_id IS NOT NULL)
  ),

  -- One active patron/patroness per gender per role per org unit
  CONSTRAINT patronage_no_duplicate_active UNIQUE (
    gender,
    level,
    COALESCE(outstation_id::text, ''),
    COALESCE(parish_id::text, ''),
    COALESCE(deanery_id::text, '')
  ) WHERE deleted_at IS NULL
);

-- =========================================================
-- INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS patronage_team_level_idx ON public.patronage_team(level);
CREATE INDEX IF NOT EXISTS patronage_team_outstation_idx ON public.patronage_team(outstation_id);
CREATE INDEX IF NOT EXISTS patronage_team_parish_idx ON public.patronage_team(parish_id);
CREATE INDEX IF NOT EXISTS patronage_team_deanery_idx ON public.patronage_team(deanery_id);
CREATE INDEX IF NOT EXISTS patronage_team_gender_idx ON public.patronage_team(gender);
CREATE INDEX IF NOT EXISTS patronage_team_created_at_idx ON public.patronage_team(created_at DESC);
CREATE INDEX IF NOT EXISTS patronage_team_deleted_at_idx ON public.patronage_team(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS patronage_team_created_by_idx ON public.patronage_team(created_by);
CREATE INDEX IF NOT EXISTS patronage_team_updated_by_idx ON public.patronage_team(updated_by);

-- =========================================================
-- AUDIT TRIGGER
-- =========================================================
CREATE TRIGGER patronage_team_touch BEFORE UPDATE ON public.patronage_team
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- RLS POLICIES
-- =========================================================
ALTER TABLE public.patronage_team ENABLE ROW LEVEL SECURITY;

-- Admin: read all active patrons/patronesses
CREATE POLICY patronage_team_read ON public.patronage_team FOR SELECT
  USING (deleted_at IS NULL);

-- Admin: create new patrons/patronesses
CREATE POLICY patronage_team_insert ON public.patronage_team FOR INSERT
  WITH CHECK (true); -- restrict to admin role in app logic

-- Admin: update patrons/patronesses
CREATE POLICY patronage_team_update ON public.patronage_team FOR UPDATE
  USING (true) WITH CHECK (true); -- restrict to admin role in app logic

-- Admin: soft-delete patrons/patronesses (revoke via permissions system)
CREATE POLICY patronage_team_delete ON public.patronage_team FOR DELETE
  USING (true); -- restrict to admin role in app logic

-- =========================================================
-- GRANTS
-- =========================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patronage_team TO authenticated, anon;
GRANT ALL ON public.patronage_team TO service_role;

-- =========================================================
-- QUERY EXAMPLES
-- =========================================================
-- 1. Get patron/patroness for a youth (org hierarchy)
--
-- SELECT pt.* FROM patronage_team pt
-- JOIN youths y ON (
--   (pt.level = 'outstation' AND pt.outstation_id = y.outstation_id)
--   OR (pt.level = 'parish' AND pt.parish_id = y.parish_id)
--   OR (pt.level = 'deanery' AND pt.deanery_id = y.deanery_id)
--   OR pt.level = 'diocese'
-- )
-- WHERE y.id = <youth_id> AND pt.deleted_at IS NULL;
--
-- 2. Permission revocation (handled via user_roles/permissions system)
-- When patron access needs to be revoked:
-- - Use existing permission/role management
-- - Or soft-delete: UPDATE patronage_team SET deleted_at = now() WHERE id = <id>
-- - RLS will exclude deleted records automatically
