-- ================================================================
-- Youth Leadership Roles
--
-- A leadership role is an appointment that links an existing
-- registered youth to a role at a specific level of the org
-- hierarchy (diocese / deanery / parish / outstation).
--
-- The same youth can hold multiple concurrent roles at different
-- levels (e.g. Parish Chairperson AND Deanery Secretary).
-- Terms are tracked via start_date / end_date; end_date IS NULL
-- means the role is currently active.
--
-- A partial unique index prevents two active holders of the same
-- role at the same org unit simultaneously.
-- ================================================================

CREATE TABLE public.youth_leadership_roles (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  youth_id      uuid        NOT NULL REFERENCES public.youths(id)      ON DELETE CASCADE,
  role          text        NOT NULL,
  level         text        NOT NULL CHECK (level IN ('diocese','deanery','parish','outstation')),
  deanery_id    uuid        REFERENCES public.deaneries(id)            ON DELETE SET NULL,
  parish_id     uuid        REFERENCES public.parishes(id)             ON DELETE SET NULL,
  outstation_id uuid        REFERENCES public.outstations(id)          ON DELETE SET NULL,
  start_date    date        NOT NULL DEFAULT CURRENT_DATE,
  end_date      date,
  notes         text,
  appointed_by  uuid        REFERENCES auth.users(id)                  ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Ensure the right FK is populated for each level
  CONSTRAINT leadership_level_fk CHECK (
    (level = 'diocese'    AND deanery_id IS NULL    AND parish_id IS NULL AND outstation_id IS NULL)
    OR (level = 'deanery' AND deanery_id IS NOT NULL AND parish_id IS NULL AND outstation_id IS NULL)
    OR (level = 'parish'  AND parish_id IS NOT NULL  AND outstation_id IS NULL)
    OR (level = 'outstation' AND outstation_id IS NOT NULL)
  )
);

-- One active holder per role per org unit at a time.
-- COALESCE converts NULL UUIDs to '' so diocese-level rows (all nulls)
-- are treated as the same "unit" for uniqueness purposes.
CREATE UNIQUE INDEX leadership_no_duplicate_active
  ON public.youth_leadership_roles (
    level,
    role,
    COALESCE(deanery_id::text,    ''),
    COALESCE(parish_id::text,     ''),
    COALESCE(outstation_id::text, '')
  )
  WHERE end_date IS NULL;

CREATE INDEX leadership_youth_idx  ON public.youth_leadership_roles (youth_id);
CREATE INDEX leadership_level_idx  ON public.youth_leadership_roles (level);
CREATE INDEX leadership_active_idx ON public.youth_leadership_roles (end_date) WHERE end_date IS NULL;

-- ----------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------
ALTER TABLE public.youth_leadership_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_read"   ON public.youth_leadership_roles FOR SELECT USING (true);
CREATE POLICY "leadership_insert" ON public.youth_leadership_roles FOR INSERT WITH CHECK (true);
CREATE POLICY "leadership_update" ON public.youth_leadership_roles FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "leadership_delete" ON public.youth_leadership_roles FOR DELETE USING (true);
