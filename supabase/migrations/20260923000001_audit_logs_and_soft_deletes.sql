-- =========================================================
-- Audit Logs & Soft-Delete Logic
-- Append-only audit logs + soft-delete aware RLS policies
-- =========================================================

-- =========================================================
-- YOUTHS_AUDIT_LOG (append-only)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.youths_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youth_id uuid NOT NULL REFERENCES public.youths(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS youths_audit_log_youth_id_idx ON public.youths_audit_log(youth_id);
CREATE INDEX IF NOT EXISTS youths_audit_log_created_at_idx ON public.youths_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS youths_audit_log_action_idx ON public.youths_audit_log(action);

ALTER TABLE public.youths_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY youths_audit_read ON public.youths_audit_log FOR SELECT USING (true);
CREATE POLICY youths_audit_insert ON public.youths_audit_log FOR INSERT WITH CHECK (true);
-- Intentionally no UPDATE or DELETE — append-only

-- =========================================================
-- CUSA_MEMBERS_AUDIT_LOG (append-only)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.cusa_members_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cusa_member_id uuid NOT NULL REFERENCES public.cusa_members(id) ON DELETE CASCADE,
  youth_id uuid NOT NULL REFERENCES public.youths(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cusa_members_audit_log_member_id_idx ON public.cusa_members_audit_log(cusa_member_id);
CREATE INDEX IF NOT EXISTS cusa_members_audit_log_youth_id_idx ON public.cusa_members_audit_log(youth_id);
CREATE INDEX IF NOT EXISTS cusa_members_audit_log_created_at_idx ON public.cusa_members_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS cusa_members_audit_log_action_idx ON public.cusa_members_audit_log(action);

ALTER TABLE public.cusa_members_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY cusa_members_audit_read ON public.cusa_members_audit_log FOR SELECT USING (true);
CREATE POLICY cusa_members_audit_insert ON public.cusa_members_audit_log FOR INSERT WITH CHECK (true);
-- Intentionally no UPDATE or DELETE — append-only

-- =========================================================
-- CUSA_TRANSITIONS_AUDIT_LOG (append-only)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.cusa_transitions_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cusa_transition_id uuid NOT NULL REFERENCES public.cusa_transitions(id) ON DELETE CASCADE,
  youth_id uuid NOT NULL REFERENCES public.youths(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cusa_transitions_audit_log_trans_id_idx ON public.cusa_transitions_audit_log(cusa_transition_id);
CREATE INDEX IF NOT EXISTS cusa_transitions_audit_log_youth_id_idx ON public.cusa_transitions_audit_log(youth_id);
CREATE INDEX IF NOT EXISTS cusa_transitions_audit_log_created_at_idx ON public.cusa_transitions_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS cusa_transitions_audit_log_action_idx ON public.cusa_transitions_audit_log(action);

ALTER TABLE public.cusa_transitions_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY cusa_transitions_audit_read ON public.cusa_transitions_audit_log FOR SELECT USING (true);
CREATE POLICY cusa_transitions_audit_insert ON public.cusa_transitions_audit_log FOR INSERT WITH CHECK (true);
-- Intentionally no UPDATE or DELETE — append-only

-- =========================================================
-- YOUTH_LEADERSHIP_ROLES_AUDIT_LOG (append-only)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.youth_leadership_roles_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.youth_leadership_roles(id) ON DELETE CASCADE,
  youth_id uuid NOT NULL REFERENCES public.youths(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS youth_leadership_roles_audit_log_role_id_idx ON public.youth_leadership_roles_audit_log(role_id);
CREATE INDEX IF NOT EXISTS youth_leadership_roles_audit_log_youth_id_idx ON public.youth_leadership_roles_audit_log(youth_id);
CREATE INDEX IF NOT EXISTS youth_leadership_roles_audit_log_created_at_idx ON public.youth_leadership_roles_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS youth_leadership_roles_audit_log_action_idx ON public.youth_leadership_roles_audit_log(action);

ALTER TABLE public.youth_leadership_roles_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY youth_leadership_roles_audit_read ON public.youth_leadership_roles_audit_log FOR SELECT USING (true);
CREATE POLICY youth_leadership_roles_audit_insert ON public.youth_leadership_roles_audit_log FOR INSERT WITH CHECK (true);
-- Intentionally no UPDATE or DELETE — append-only

-- =========================================================
-- SOFT-DELETE AWARE RLS POLICIES
-- All queries should filter: WHERE deleted_at IS NULL
-- Admin queries can pass include_deleted flag if needed
-- =========================================================

-- Drop existing open policies and replace with soft-delete aware ones
DROP POLICY IF EXISTS "public_read_youths" ON public.youths;
CREATE POLICY youths_read ON public.youths FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "public_read_enrollments" ON public.enrollments;
CREATE POLICY enrollments_read ON public.enrollments FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "public_read_cusa_members" ON public.cusa_members;
CREATE POLICY cusa_members_read ON public.cusa_members FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "public_read_cusa_transitions" ON public.cusa_transitions;
CREATE POLICY cusa_transitions_read ON public.cusa_transitions FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "public_read_mission_nominees" ON public.mission_nominees;
CREATE POLICY mission_nominees_read ON public.mission_nominees FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "public_read_mission_pairings" ON public.mission_pairings;
CREATE POLICY mission_pairings_read ON public.mission_pairings FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "leadership_read" ON public.youth_leadership_roles;
CREATE POLICY youth_leadership_roles_read ON public.youth_leadership_roles FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "public_read_event_registrations" ON public.event_registrations;
CREATE POLICY event_registrations_read ON public.event_registrations FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "public_read_event_checkins" ON public.event_checkins;
CREATE POLICY event_checkins_read ON public.event_checkins FOR SELECT USING (deleted_at IS NULL);

-- =========================================================
-- SOFT DELETE IMPLEMENTATION NOTES
-- =========================================================
-- Instead of DELETE, call:
-- UPDATE youths SET deleted_at = now(), deleted_by = <user_id> WHERE id = <id>;
--
-- To permanently delete (hard delete):
-- DELETE FROM youths WHERE id = <id> AND deleted_at IS NOT NULL;
-- (reserved for admin cleanup, not regular operations)
--
-- To query including soft-deleted records (admin view):
-- SELECT * FROM youths WHERE deleted_at IS NULL;  -- or
-- SELECT * FROM youths;  -- if explicitly handling soft-delete awareness
--
-- Audit logs are never soft-deleted — they're append-only immutable records.
