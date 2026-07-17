-- ================================================================
-- Events + Uniforms extended lifecycle, Formation text content
--
-- Events: poster image, and an optional youth_id link on duty
-- assignees so a leader can see "your assigned duty" on the portal.
--
-- Uniforms: today a sale only has payment_status (unpaid/partial/paid)
-- and a single delivered_at timestamp — no order pipeline, no dispatch
-- info, no delivery location, no human-friendly tracking reference.
-- Adds a `stage` pipeline (placed -> confirmed -> dispatched ->
-- delivered, or cancelled) alongside payment, dispatch contact/method,
-- a delivery location, and an ORD-YYYY-NNNNN reference — mirroring the
-- existing CDM-number pattern. Also tags each production stock entry
-- with an activity (sewing/logo/branding) instead of a flat log.
--
-- Formation: content_text lets staff paste readable content directly
-- as an alternative to uploading a file.
-- ================================================================

-- ----------------------------------------------------------------
-- Events: poster + duty youth-link
-- ----------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS poster_url text;

ALTER TABLE public.event_duty_assignees
  ADD COLUMN IF NOT EXISTS youth_id uuid REFERENCES public.youths(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_duty_assignees_youth_idx ON public.event_duty_assignees(youth_id);

-- ----------------------------------------------------------------
-- Uniform order lifecycle
-- ----------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.uniform_order_serial START 1;

CREATE OR REPLACE FUNCTION public.next_order_ref()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT 'ORD-' || extract(year from now())::text || '-' || lpad(nextval('public.uniform_order_serial')::text, 5, '0')
$$;

DROP TYPE IF EXISTS public.uniform_order_stage CASCADE;
CREATE TYPE public.uniform_order_stage AS ENUM ('placed', 'confirmed', 'dispatched', 'delivered', 'cancelled');

ALTER TABLE public.uniform_sales
  ADD COLUMN IF NOT EXISTS order_ref          text,
  ADD COLUMN IF NOT EXISTS stage              public.uniform_order_stage NOT NULL DEFAULT 'placed',
  ADD COLUMN IF NOT EXISTS delivery_location  text,
  ADD COLUMN IF NOT EXISTS confirmed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispatch_contact_name  text,
  ADD COLUMN IF NOT EXISTS dispatch_contact_phone text,
  ADD COLUMN IF NOT EXISTS dispatch_method        text,
  ADD COLUMN IF NOT EXISTS dispatch_scheduled_at  timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_at          timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_by           text;

-- Backfill order_ref row-by-row (each iteration is its own statement, so the
-- nextval() inside next_order_ref() is guaranteed fresh per row — doing this
-- as a single set-based UPDATE risks the planner treating the STABLE
-- function as constant across the whole statement and reusing one value).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.uniform_sales WHERE order_ref IS NULL LOOP
    UPDATE public.uniform_sales SET order_ref = public.next_order_ref() WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.uniform_sales ALTER COLUMN order_ref SET DEFAULT public.next_order_ref();
ALTER TABLE public.uniform_sales ADD CONSTRAINT uniform_sales_order_ref_key UNIQUE (order_ref);

CREATE INDEX IF NOT EXISTS uniform_sales_stage_idx ON public.uniform_sales(stage);

-- ----------------------------------------------------------------
-- Production log: tag each entry as sewing / logo / branding
-- ----------------------------------------------------------------
DROP TYPE IF EXISTS public.uniform_production_activity CASCADE;
CREATE TYPE public.uniform_production_activity AS ENUM ('sewing', 'logo', 'branding');

ALTER TABLE public.uniform_stock_entries
  ADD COLUMN IF NOT EXISTS activity public.uniform_production_activity NOT NULL DEFAULT 'sewing';

CREATE INDEX IF NOT EXISTS uniform_stock_entries_activity_idx ON public.uniform_stock_entries(activity);

-- ----------------------------------------------------------------
-- Formation: plain-text content alternative to a file upload
-- ----------------------------------------------------------------
ALTER TABLE public.formation_items
  ADD COLUMN IF NOT EXISTS content_text text;

-- ----------------------------------------------------------------
-- Notifications: add a 'uniform' category (used from the next migration)
-- ----------------------------------------------------------------
ALTER TYPE public.notification_category ADD VALUE IF NOT EXISTS 'uniform';

-- ----------------------------------------------------------------
-- Storage bucket for event posters — public read, staff-only write
-- ----------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('events', 'events', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "events_public_read" ON storage.objects;
CREATE POLICY "events_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'events');

DROP POLICY IF EXISTS "events_staff_insert" ON storage.objects;
CREATE POLICY "events_staff_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'events'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  );

DROP POLICY IF EXISTS "events_staff_update" ON storage.objects;
CREATE POLICY "events_staff_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'events'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  );

DROP POLICY IF EXISTS "events_staff_delete" ON storage.objects;
CREATE POLICY "events_staff_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'events'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'moderator'))
  );
