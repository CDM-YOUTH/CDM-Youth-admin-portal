-- =========================================================
-- Core Audit Fields Migration
-- Adds created_by, updated_by, deleted_at, deleted_by
-- to core tables for comprehensive audit trail
-- =========================================================

-- =========================================================
-- YOUTHS
-- =========================================================
ALTER TABLE public.youths
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS youths_deleted_at_idx ON public.youths(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS youths_created_by_idx ON public.youths(created_by);
CREATE INDEX IF NOT EXISTS youths_updated_by_idx ON public.youths(updated_by);

-- =========================================================
-- ENROLLMENTS
-- =========================================================
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS enrollments_touch ON public.enrollments;
CREATE TRIGGER enrollments_touch BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS enrollments_deleted_at_idx ON public.enrollments(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS enrollments_created_by_idx ON public.enrollments(created_by);
CREATE INDEX IF NOT EXISTS enrollments_updated_by_idx ON public.enrollments(updated_by);

-- =========================================================
-- CUSA_MEMBERS
-- =========================================================
ALTER TABLE public.cusa_members
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS cusa_members_touch ON public.cusa_members;
CREATE TRIGGER cusa_members_touch BEFORE UPDATE ON public.cusa_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS cusa_members_deleted_at_idx ON public.cusa_members(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS cusa_members_created_by_idx ON public.cusa_members(created_by);
CREATE INDEX IF NOT EXISTS cusa_members_updated_by_idx ON public.cusa_members(updated_by);

-- =========================================================
-- CUSA_TRANSITIONS
-- =========================================================
ALTER TABLE public.cusa_transitions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Note: processed_by already exists, use it as created_by equivalent
ALTER TABLE public.cusa_transitions
  RENAME COLUMN processed_by TO created_by;

DROP TRIGGER IF EXISTS cusa_transitions_touch ON public.cusa_transitions;
CREATE TRIGGER cusa_transitions_touch BEFORE UPDATE ON public.cusa_transitions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS cusa_transitions_deleted_at_idx ON public.cusa_transitions(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS cusa_transitions_updated_by_idx ON public.cusa_transitions(updated_by);

-- =========================================================
-- MISSION_NOMINEES
-- =========================================================
ALTER TABLE public.mission_nominees
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS mission_nominees_touch ON public.mission_nominees;
CREATE TRIGGER mission_nominees_touch BEFORE UPDATE ON public.mission_nominees
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS mission_nominees_deleted_at_idx ON public.mission_nominees(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS mission_nominees_created_by_idx ON public.mission_nominees(created_by);
CREATE INDEX IF NOT EXISTS mission_nominees_updated_by_idx ON public.mission_nominees(updated_by);

-- =========================================================
-- MISSION_PAIRINGS
-- =========================================================
ALTER TABLE public.mission_pairings
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS mission_pairings_touch ON public.mission_pairings;
CREATE TRIGGER mission_pairings_touch BEFORE UPDATE ON public.mission_pairings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS mission_pairings_deleted_at_idx ON public.mission_pairings(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS mission_pairings_created_by_idx ON public.mission_pairings(created_by);
CREATE INDEX IF NOT EXISTS mission_pairings_updated_by_idx ON public.mission_pairings(updated_by);

-- =========================================================
-- YOUTH_LEADERSHIP_ROLES
-- =========================================================
ALTER TABLE public.youth_leadership_roles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Note: appointed_by already exists, use it as created_by equivalent
-- Rename for consistency with other tables
ALTER TABLE public.youth_leadership_roles
  RENAME COLUMN appointed_by TO created_by;

DROP TRIGGER IF EXISTS youth_leadership_roles_touch ON public.youth_leadership_roles;
CREATE TRIGGER youth_leadership_roles_touch BEFORE UPDATE ON public.youth_leadership_roles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS youth_leadership_roles_deleted_at_idx ON public.youth_leadership_roles(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS youth_leadership_roles_updated_by_idx ON public.youth_leadership_roles(updated_by);

-- =========================================================
-- EVENT_REGISTRATIONS
-- =========================================================
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS event_registrations_touch ON public.event_registrations;
CREATE TRIGGER event_registrations_touch BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS event_registrations_deleted_at_idx ON public.event_registrations(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS event_registrations_created_by_idx ON public.event_registrations(created_by);
CREATE INDEX IF NOT EXISTS event_registrations_updated_by_idx ON public.event_registrations(updated_by);

-- =========================================================
-- EVENT_CHECKINS
-- =========================================================
ALTER TABLE public.event_checkins
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS event_checkins_touch ON public.event_checkins;
CREATE TRIGGER event_checkins_touch BEFORE UPDATE ON public.event_checkins
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS event_checkins_deleted_at_idx ON public.event_checkins(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS event_checkins_created_by_idx ON public.event_checkins(created_by);
CREATE INDEX IF NOT EXISTS event_checkins_updated_by_idx ON public.event_checkins(updated_by);

-- =========================================================
-- Soft-delete aware RLS: update policies to exclude deleted
-- =========================================================
-- Updated policies will be added as needed when fetching;
-- application layer should filter: WHERE deleted_at IS NULL
-- or use explicit include_deleted parameter if admin needs to view deleted records.
