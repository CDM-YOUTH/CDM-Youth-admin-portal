-- CUSA: one row per youth per year
ALTER TABLE public.cusa_members DROP CONSTRAINT IF EXISTS cusa_members_youth_id_key;
ALTER TABLE public.cusa_members ADD COLUMN IF NOT EXISTS year integer NOT NULL DEFAULT EXTRACT(year FROM now())::integer;
CREATE INDEX IF NOT EXISTS cusa_members_year_idx ON public.cusa_members(year);
ALTER TABLE public.cusa_members ADD CONSTRAINT cusa_members_youth_id_year_key UNIQUE(youth_id, year);

-- CUSA transitions log
CREATE TABLE public.cusa_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youth_id uuid NOT NULL REFERENCES public.youths(id) ON DELETE CASCADE,
  from_category text,
  to_category text NOT NULL,
  reason text,
  processed_by text,
  effective_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cusa_transitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cusa_transitions TO anon;
GRANT ALL ON public.cusa_transitions TO service_role;
ALTER TABLE public.cusa_transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_cusa_transitions"   ON public.cusa_transitions FOR SELECT USING (true);
CREATE POLICY "public_insert_cusa_transitions" ON public.cusa_transitions FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_cusa_transitions" ON public.cusa_transitions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_delete_cusa_transitions" ON public.cusa_transitions FOR DELETE USING (true);
CREATE INDEX cusa_transitions_youth_idx ON public.cusa_transitions(youth_id, effective_date DESC);

-- Per-year category lives on the enrollment record (annual snapshot)
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS category public.youth_category;