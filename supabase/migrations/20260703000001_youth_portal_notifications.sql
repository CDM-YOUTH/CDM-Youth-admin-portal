-- ================================================================
-- Youth Portal — notifications + password-reset OTP codes
-- Split into its own migration/transaction so the 'Other' enum value
-- added in the previous migration is safely committed first.
-- ================================================================

-- ----------------------------------------------------------------
-- Notifications — per-user inbox (Home preview + Notifications tab)
-- ----------------------------------------------------------------
CREATE TYPE public.notification_category AS ENUM ('formation','event','account','enrollment','mission','welfare','general');

CREATE TABLE public.notifications (
  id          uuid                          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid                          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    public.notification_category  NOT NULL DEFAULT 'general',
  title       text                          NOT NULL,
  body        text,
  is_read     boolean                       NOT NULL DEFAULT false,
  related_id  uuid,
  created_at  timestamptz                   NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_idx    ON public.notifications(user_id, created_at DESC);
CREATE INDEX notifications_unread_idx  ON public.notifications(user_id) WHERE NOT is_read;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_self_read" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_self_update" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_staff_all" ON public.notifications FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
    OR public.has_role(auth.uid(), 'moderator')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office')
    OR public.has_role(auth.uid(), 'moderator')
  );

-- Inserts happen server-side (service-role) when something notification-worthy
-- happens (enrollment confirmed, event reminder, etc.) — no client insert policy.

-- ----------------------------------------------------------------
-- OTP codes — phone-based password reset. Service-role only: no
-- policy is granted to anon/authenticated, so RLS denies them by
-- default and only the server (using the service-role client) can
-- read or write this table.
-- ----------------------------------------------------------------
CREATE TYPE public.otp_purpose AS ENUM ('password_reset');

CREATE TABLE public.otp_codes (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        text          NOT NULL,
  code_hash    text          NOT NULL,
  purpose      public.otp_purpose NOT NULL DEFAULT 'password_reset',
  expires_at   timestamptz   NOT NULL,
  consumed_at  timestamptz,
  attempts     int           NOT NULL DEFAULT 0,
  created_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX otp_codes_phone_idx ON public.otp_codes(phone, purpose);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies for anon/authenticated — service_role bypasses RLS.
