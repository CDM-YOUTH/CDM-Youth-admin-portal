-- Extend the profiles org scope from deanery/parish to also include outstation,
-- matching the diocese hierarchy (deanery -> parish -> outstation).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS outstation_id uuid REFERENCES public.outstations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_outstation_id_idx ON public.profiles(outstation_id);
