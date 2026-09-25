-- =========================================================
-- Uniforms Restructure - Phase 1: Items & Activities
-- Rename uniform_skus to uniform_items
-- Create uniform_activities lookup table
-- =========================================================

-- =========================================================
-- UNIFORM_ITEMS (renamed from uniform_skus)
-- =========================================================
-- Create new table with improved structure
CREATE TABLE IF NOT EXISTS public.uniform_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  swatch text,
  unit_price numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Migrate data from uniform_skus if it exists
INSERT INTO public.uniform_items (id, name, swatch, unit_price, created_at, updated_at)
SELECT id, name, swatch, unit_price, created_at, updated_at
FROM public.uniform_skus
ON CONFLICT (name) DO NOTHING;

DROP TRIGGER IF EXISTS uniform_items_touch ON public.uniform_items;
CREATE TRIGGER uniform_items_touch BEFORE UPDATE ON public.uniform_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.uniform_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY uniform_items_read ON public.uniform_items FOR SELECT USING (true);
CREATE POLICY uniform_items_insert ON public.uniform_items FOR INSERT WITH CHECK (true);
CREATE POLICY uniform_items_update ON public.uniform_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY uniform_items_delete ON public.uniform_items FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uniform_items TO authenticated, anon;
GRANT ALL ON public.uniform_items TO service_role;

-- =========================================================
-- UNIFORM_ACTIVITIES (activity types for stock entries)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.uniform_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  activity_type text NOT NULL DEFAULT 'in' CHECK (activity_type IN ('in', 'out')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Pre-populate common activities
INSERT INTO public.uniform_activities (name, activity_type, description) VALUES
  ('Sewn', 'in', 'New uniforms sewn in the youth office'),
  ('Received from Supplier', 'in', 'Bulk delivery from external supplier'),
  ('Damaged Return', 'out', 'Uniforms returned due to damage'),
  ('Expired Stock', 'out', 'Old stock cleared'),
  ('Audit Adjustment', 'in', 'Inventory count correction')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.uniform_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY uniform_activities_read ON public.uniform_activities FOR SELECT USING (true);
CREATE POLICY uniform_activities_insert ON public.uniform_activities FOR INSERT WITH CHECK (true);
CREATE POLICY uniform_activities_update ON public.uniform_activities FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY uniform_activities_delete ON public.uniform_activities FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uniform_activities TO authenticated, anon;
GRANT ALL ON public.uniform_activities TO service_role;

-- =========================================================
-- UNIFORM_STOCK_ENTRIES (stock in logs — append-only)
-- =========================================================
-- Create fresh table with proper audit fields
DROP TABLE IF EXISTS public.uniform_stock_entries CASCADE;
CREATE TABLE public.uniform_stock_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.uniform_items(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.uniform_activities(id) ON DELETE RESTRICT,
  quantity int NOT NULL CHECK (quantity > 0),
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS uniform_stock_entries_item_idx ON public.uniform_stock_entries(item_id);
CREATE INDEX IF NOT EXISTS uniform_stock_entries_activity_idx ON public.uniform_stock_entries(activity_id);
CREATE INDEX IF NOT EXISTS uniform_stock_entries_created_at_idx ON public.uniform_stock_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS uniform_stock_entries_deleted_at_idx ON public.uniform_stock_entries(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER uniform_stock_entries_touch BEFORE UPDATE ON public.uniform_stock_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.uniform_stock_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY uniform_stock_entries_read ON public.uniform_stock_entries FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY uniform_stock_entries_insert ON public.uniform_stock_entries FOR INSERT WITH CHECK (true);
CREATE POLICY uniform_stock_entries_update ON public.uniform_stock_entries FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY uniform_stock_entries_delete ON public.uniform_stock_entries FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uniform_stock_entries TO authenticated, anon;
GRANT ALL ON public.uniform_stock_entries TO service_role;

-- =========================================================
-- CLEANUP: Drop old uniform_skus table
-- =========================================================
DROP TABLE IF EXISTS public.uniform_skus;
