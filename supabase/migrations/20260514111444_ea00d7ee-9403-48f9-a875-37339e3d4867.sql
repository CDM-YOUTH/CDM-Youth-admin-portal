-- Mission Week
CREATE TYPE public.mission_week_status AS ENUM ('planning','nominations','pairing','execution','closed');
CREATE TYPE public.mission_phase_status AS ENUM ('upcoming','active','done');
CREATE TYPE public.mission_nominee_status AS ENUM ('nominated','confirmed','withdrawn');
CREATE TYPE public.mission_pairing_status AS ENUM ('pending','sent','received','reported');

CREATE TABLE public.mission_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL UNIQUE,
  theme text,
  start_date date,
  end_date date,
  status mission_week_status NOT NULL DEFAULT 'planning',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mission_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_week_id uuid NOT NULL REFERENCES public.mission_weeks(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  name text NOT NULL,
  phase_date text,
  status mission_phase_status NOT NULL DEFAULT 'upcoming',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mission_phases (mission_week_id, position);

CREATE TABLE public.mission_nominees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_week_id uuid NOT NULL REFERENCES public.mission_weeks(id) ON DELETE CASCADE,
  youth_id uuid NOT NULL,
  source_parish_id uuid,
  status mission_nominee_status NOT NULL DEFAULT 'nominated',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_week_id, youth_id)
);
CREATE INDEX ON public.mission_nominees (mission_week_id);

CREATE TABLE public.mission_pairings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_week_id uuid NOT NULL REFERENCES public.mission_weeks(id) ON DELETE CASCADE,
  youth_id uuid NOT NULL,
  host_deanery_id uuid,
  host_parish_id uuid,
  host_outstation_id uuid,
  status mission_pairing_status NOT NULL DEFAULT 'pending',
  report_summary text,
  report_submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mission_pairings (mission_week_id);

ALTER TABLE public.mission_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_nominees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_pairings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['mission_weeks','mission_phases','mission_nominees','mission_pairings']) LOOP
    EXECUTE format('CREATE POLICY public_read_%1$s ON public.%1$s FOR SELECT USING (true)', t);
    EXECUTE format('CREATE POLICY public_insert_%1$s ON public.%1$s FOR INSERT WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY public_update_%1$s ON public.%1$s FOR UPDATE USING (true) WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY public_delete_%1$s ON public.%1$s FOR DELETE USING (true)', t);
  END LOOP;
END $$;

CREATE TRIGGER mission_weeks_touch BEFORE UPDATE ON public.mission_weeks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Event registrations (RSVPs separate from day-of check-ins)
CREATE TABLE public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  youth_id uuid,
  guest_name text,
  guest_phone text,
  guest_email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, youth_id)
);
CREATE INDEX ON public.event_registrations (event_id);

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_read_event_registrations ON public.event_registrations FOR SELECT USING (true);
CREATE POLICY public_insert_event_registrations ON public.event_registrations FOR INSERT WITH CHECK (true);
CREATE POLICY public_update_event_registrations ON public.event_registrations FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY public_delete_event_registrations ON public.event_registrations FOR DELETE USING (true);

-- Enrollment audit log (append-only)
CREATE TABLE public.enrollment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid,
  youth_id uuid,
  action text NOT NULL,
  actor text,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.enrollment_audit_log (enrollment_id);
CREATE INDEX ON public.enrollment_audit_log (youth_id);
CREATE INDEX ON public.enrollment_audit_log (created_at DESC);

ALTER TABLE public.enrollment_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_read_enrollment_audit_log ON public.enrollment_audit_log FOR SELECT USING (true);
CREATE POLICY public_insert_enrollment_audit_log ON public.enrollment_audit_log FOR INSERT WITH CHECK (true);
-- intentionally no UPDATE or DELETE policy — append-only