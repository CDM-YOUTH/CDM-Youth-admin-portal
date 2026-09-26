-- =========================================================
-- Patron Leadership Roles
-- Patrons can have additional leadership responsibilities
-- at parish, deanery, or diocese level (beyond their base location)
-- =========================================================

-- =========================================================
-- PATRON_LEADERSHIP (Leadership roles for patrons)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.patron_leadership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- LINK TO PATRON
  patron_id uuid NOT NULL REFERENCES public.patronage_team(id) ON DELETE CASCADE,

  -- LEADERSHIP LEVEL
  level text NOT NULL CHECK (level IN ('parish', 'deanery', 'diocese')),

  -- ORG UNIT ASSIGNMENT
  parish_id uuid REFERENCES public.parishes(id) ON DELETE CASCADE,
  deanery_id uuid REFERENCES public.deaneries(id) ON DELETE CASCADE,

  -- TERM
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date, -- NULL means active

  -- AUDIT FIELDS
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- CONSTRAINT: ensure correct org FK for each level
  CONSTRAINT patron_leadership_level_fk CHECK (
    (level = 'diocese'    AND deanery_id IS NULL AND parish_id IS NULL)
    OR (level = 'deanery' AND deanery_id IS NOT NULL AND parish_id IS NULL)
    OR (level = 'parish'  AND parish_id IS NOT NULL)
  )
);

-- =========================================================
-- INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS patron_leadership_patron_idx ON public.patron_leadership(patron_id);
CREATE INDEX IF NOT EXISTS patron_leadership_level_idx ON public.patron_leadership(level);
CREATE INDEX IF NOT EXISTS patron_leadership_parish_idx ON public.patron_leadership(parish_id);
CREATE INDEX IF NOT EXISTS patron_leadership_deanery_idx ON public.patron_leadership(deanery_id);
CREATE INDEX IF NOT EXISTS patron_leadership_start_date_idx ON public.patron_leadership(start_date DESC);
CREATE INDEX IF NOT EXISTS patron_leadership_deleted_at_idx ON public.patron_leadership(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS patron_leadership_created_by_idx ON public.patron_leadership(created_by);
CREATE INDEX IF NOT EXISTS patron_leadership_updated_by_idx ON public.patron_leadership(updated_by);

-- =========================================================
-- AUDIT TRIGGER
-- =========================================================
CREATE TRIGGER patron_leadership_touch BEFORE UPDATE ON public.patron_leadership
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- RLS POLICIES
-- =========================================================
ALTER TABLE public.patron_leadership ENABLE ROW LEVEL SECURITY;

-- Admin: read all active leadership roles
CREATE POLICY patron_leadership_read ON public.patron_leadership FOR SELECT
  USING (deleted_at IS NULL);

-- Admin: create new leadership roles
CREATE POLICY patron_leadership_insert ON public.patron_leadership FOR INSERT
  WITH CHECK (true); -- restrict to admin role in app logic

-- Admin: update leadership roles
CREATE POLICY patron_leadership_update ON public.patron_leadership FOR UPDATE
  USING (true) WITH CHECK (true); -- restrict to admin role in app logic

-- Admin: soft-delete leadership roles
CREATE POLICY patron_leadership_delete ON public.patron_leadership FOR DELETE
  USING (true); -- restrict to admin role in app logic

-- =========================================================
-- GRANTS
-- =========================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patron_leadership TO authenticated, anon;
GRANT ALL ON public.patron_leadership TO service_role;
