ALTER TABLE public.mission_nominees
  ADD CONSTRAINT mission_nominees_youth_id_fkey
    FOREIGN KEY (youth_id) REFERENCES public.youths(id) ON DELETE CASCADE,
  ADD CONSTRAINT mission_nominees_source_parish_id_fkey
    FOREIGN KEY (source_parish_id) REFERENCES public.parishes(id) ON DELETE SET NULL;

ALTER TABLE public.mission_pairings
  ADD CONSTRAINT mission_pairings_youth_id_fkey
    FOREIGN KEY (youth_id) REFERENCES public.youths(id) ON DELETE CASCADE,
  ADD CONSTRAINT mission_pairings_host_parish_id_fkey
    FOREIGN KEY (host_parish_id) REFERENCES public.parishes(id) ON DELETE SET NULL,
  ADD CONSTRAINT mission_pairings_host_deanery_id_fkey
    FOREIGN KEY (host_deanery_id) REFERENCES public.deaneries(id) ON DELETE SET NULL,
  ADD CONSTRAINT mission_pairings_host_outstation_id_fkey
    FOREIGN KEY (host_outstation_id) REFERENCES public.outstations(id) ON DELETE SET NULL;