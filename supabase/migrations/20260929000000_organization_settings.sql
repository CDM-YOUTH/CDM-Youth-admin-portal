-- =========================================================
-- Organization Settings
-- Central configuration for diocese-wide and feature settings
-- =========================================================

-- =========================================================
-- ORGANIZATION_SETTINGS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  category text DEFAULT 'general',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_settings_key_idx ON public.organization_settings(key);
CREATE INDEX IF NOT EXISTS org_settings_category_idx ON public.organization_settings(category);

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_settings_read ON public.organization_settings FOR SELECT USING (true);
CREATE POLICY org_settings_write ON public.organization_settings FOR INSERT, UPDATE
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE email LIKE '%@admin.%' OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )));

-- =========================================================
-- SEED INITIAL SETTINGS
-- =========================================================
INSERT INTO public.organization_settings (key, value, description, category) VALUES
  (
    'uniform_low_stock_threshold',
    '{"value": 50, "unit": "units"}'::jsonb,
    'Threshold below which uniform items are marked as critical stock level',
    'uniforms'
  ),
  (
    'uniform_medium_stock_threshold',
    '{"value": 200, "unit": "units"}'::jsonb,
    'Threshold below which uniform items are marked as low stock level',
    'uniforms'
  ),
  (
    'uniform_items_page_size',
    '{"value": 10, "unit": "items"}'::jsonb,
    'Number of items to display per page in uniform items table',
    'uniforms'
  ),
  (
    'uniform_entries_page_size',
    '{"value": 10, "unit": "items"}'::jsonb,
    'Number of stock entries to display per page',
    'uniforms'
  ),
  (
    'uniform_orders_page_size',
    '{"value": 10, "unit": "items"}'::jsonb,
    'Number of orders to display per page',
    'uniforms'
  )
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- FUNCTION TO GET SETTING VALUE
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_setting(setting_key text, default_value jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT value FROM public.organization_settings WHERE key = setting_key),
    default_value
  );
$$;

-- =========================================================
-- FUNCTION TO UPDATE SETTING
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_setting(setting_key text, new_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  UPDATE public.organization_settings
  SET value = new_value, updated_at = now(), updated_by = auth.uid()
  WHERE key = setting_key
  RETURNING value INTO result;

  IF result IS NULL THEN
    INSERT INTO public.organization_settings (key, value, updated_by)
    VALUES (setting_key, new_value, auth.uid())
    RETURNING value INTO result;
  END IF;

  RETURN result;
END;
$$;

-- =========================================================
-- COMMENTS
-- =========================================================
-- Usage:
-- SELECT get_setting('uniform_low_stock_threshold') ->> 'value'::int;
-- SELECT update_setting('uniform_low_stock_threshold', '{"value": 75, "unit": "units"}'::jsonb);
