-- =========================================================
-- Welfare Cases Restructure
-- Simplified core table + append-only history timeline
-- =========================================================

-- =========================================================
-- WELFARE_CASES (restructured)
-- =========================================================
-- Drop legacy backup if it exists, then backup old table
DROP TABLE IF EXISTS public.welfare_cases_legacy CASCADE;
ALTER TABLE IF EXISTS public.welfare_cases RENAME TO welfare_cases_legacy;

-- Create new simplified table
DROP TABLE IF EXISTS public.welfare_cases CASCADE;
CREATE TABLE public.welfare_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_ref text NOT NULL UNIQUE,

  -- YOUTH IDENTIFICATION
  youth_id uuid NOT NULL REFERENCES public.youths(id) ON DELETE CASCADE,
  cdm_id text NOT NULL, -- denormalized for quick lookup
  phone text, -- can override youth's phone if needed

  -- CASE DETAILS
  category text NOT NULL,
  urgency public.welfare_urgency NOT NULL DEFAULT 'medium',
  description text, -- renamed from notes
  assigned_to text, -- staff name or assignee identifier

  -- STATUS & TIMELINE
  status public.welfare_status NOT NULL DEFAULT 'open',
  opened_at timestamptz,
  resolved_at timestamptz,

  -- AUDIT FIELDS
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Auto-generate case_ref similar to old pattern
CREATE SEQUENCE IF NOT EXISTS public.welfare_case_seq START 1;

CREATE OR REPLACE FUNCTION public.next_welfare_case_ref()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT 'WF-' || extract(year from now())::text || '-' || lpad(nextval('public.welfare_case_seq')::text, 3, '0')
$$;

-- Set default for case_ref
ALTER TABLE public.welfare_cases
  ALTER COLUMN case_ref SET DEFAULT public.next_welfare_case_ref();

-- =========================================================
-- INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS welfare_cases_youth_idx ON public.welfare_cases(youth_id);
CREATE INDEX IF NOT EXISTS welfare_cases_cdm_id_idx ON public.welfare_cases(cdm_id);
CREATE INDEX IF NOT EXISTS welfare_cases_status_idx ON public.welfare_cases(status);
CREATE INDEX IF NOT EXISTS welfare_cases_urgency_idx ON public.welfare_cases(urgency);
CREATE INDEX IF NOT EXISTS welfare_cases_created_at_idx ON public.welfare_cases(created_at DESC);
CREATE INDEX IF NOT EXISTS welfare_cases_resolved_at_idx ON public.welfare_cases(resolved_at) WHERE resolved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS welfare_cases_deleted_at_idx ON public.welfare_cases(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS welfare_cases_created_by_idx ON public.welfare_cases(created_by);
CREATE INDEX IF NOT EXISTS welfare_cases_updated_by_idx ON public.welfare_cases(updated_by);

-- =========================================================
-- AUDIT TRIGGER
-- =========================================================
CREATE TRIGGER welfare_cases_touch BEFORE UPDATE ON public.welfare_cases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- WELFARE_CASE_HISTORY (append-only timeline)
-- =========================================================
-- Track all state transitions, assignments, comments, resolutions
DROP TABLE IF EXISTS public.welfare_case_history CASCADE;
CREATE TABLE public.welfare_case_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.welfare_cases(id) ON DELETE CASCADE,
  youth_id uuid NOT NULL REFERENCES public.youths(id) ON DELETE CASCADE,

  -- ACTION TYPE
  action text NOT NULL CHECK (action IN (
    'created',
    'opened',
    'assigned',
    'status_changed',
    'appointment_scheduled',
    'commented',
    'resolved'
  )),

  -- STATE CHANGES (for tracking transitions)
  status_before public.welfare_status,
  status_after public.welfare_status,
  assigned_to_before text,
  assigned_to_after text,

  -- COMMENT/NOTES AT THIS STAGE
  comment text,

  -- WHO & WHEN
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),

  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- HISTORY INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS welfare_case_history_case_id_idx ON public.welfare_case_history(case_id);
CREATE INDEX IF NOT EXISTS welfare_case_history_youth_id_idx ON public.welfare_case_history(youth_id);
CREATE INDEX IF NOT EXISTS welfare_case_history_action_idx ON public.welfare_case_history(action);
CREATE INDEX IF NOT EXISTS welfare_case_history_performed_at_idx ON public.welfare_case_history(performed_at DESC);
CREATE INDEX IF NOT EXISTS welfare_case_history_performed_by_idx ON public.welfare_case_history(performed_by);

-- =========================================================
-- RLS POLICIES
-- =========================================================
ALTER TABLE public.welfare_cases ENABLE ROW LEVEL SECURITY;

-- Admin: read all active cases + org-scoped access
CREATE POLICY welfare_cases_read_admin ON public.welfare_cases FOR SELECT
  USING (deleted_at IS NULL);

-- Admin: create, update cases
CREATE POLICY welfare_cases_insert_admin ON public.welfare_cases FOR INSERT
  WITH CHECK (true); -- restrict to admin role in app logic

CREATE POLICY welfare_cases_update_admin ON public.welfare_cases FOR UPDATE
  USING (true) WITH CHECK (true); -- restrict to admin role in app logic

-- Youth: see their own cases (optional — admin portal only for now)
CREATE POLICY welfare_cases_read_youth ON public.welfare_cases FOR SELECT
  USING (
    deleted_at IS NULL AND
    youth_id = auth.uid()
  );

-- =========================================================
-- CASE HISTORY RLS
-- =========================================================
ALTER TABLE public.welfare_case_history ENABLE ROW LEVEL SECURITY;

-- Admin: read all history
CREATE POLICY welfare_case_history_read_admin ON public.welfare_case_history FOR SELECT
  USING (true);

-- Admin: log history entries
CREATE POLICY welfare_case_history_insert_admin ON public.welfare_case_history FOR INSERT
  WITH CHECK (true); -- restrict to admin role in app logic

-- History is append-only, no UPDATE or DELETE

-- Youth: see history of their own cases (optional)
CREATE POLICY welfare_case_history_read_youth ON public.welfare_case_history FOR SELECT
  USING (youth_id = auth.uid());

-- =========================================================
-- GRANTS
-- =========================================================
GRANT SELECT, INSERT, UPDATE ON public.welfare_cases TO authenticated, anon;
GRANT ALL ON public.welfare_cases TO service_role;

GRANT SELECT, INSERT ON public.welfare_case_history TO authenticated, anon;
GRANT ALL ON public.welfare_case_history TO service_role;

GRANT USAGE ON SEQUENCE public.welfare_case_seq TO authenticated, anon, service_role;

-- =========================================================
-- NOTES ON ORG HIERARCHY
-- =========================================================
-- To get org context for a case, JOIN to youths:
--
-- SELECT wc.*, y.deanery_id, y.parish_id, y.outstation_id
-- FROM welfare_cases wc
-- JOIN youths y ON wc.youth_id = y.id
-- WHERE wc.deleted_at IS NULL;
--
-- This avoids denormalization and keeps org hierarchy
-- a single source of truth in the youths table.
