-- =========================================================
-- Uniform Categories Table
-- Manage uniform item categories: Youth, YACA, CWA, CMA, PMC, etc
-- =========================================================

-- =========================================================
-- UNIFORM_CATEGORIES TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.uniform_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uniform_categories_name_idx ON public.uniform_categories(name);
CREATE INDEX IF NOT EXISTS uniform_categories_is_active_idx ON public.uniform_categories(is_active);
CREATE INDEX IF NOT EXISTS uniform_categories_sort_order_idx ON public.uniform_categories(sort_order);

ALTER TABLE public.uniform_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY uniform_categories_read ON public.uniform_categories FOR SELECT USING (is_active = true);
CREATE POLICY uniform_categories_write ON public.uniform_categories FOR INSERT, UPDATE
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )));

-- =========================================================
-- MIGRATE uniform_items: Add category_id foreign key
-- =========================================================
ALTER TABLE public.uniform_items
DROP COLUMN IF EXISTS category;

ALTER TABLE public.uniform_items
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.uniform_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS uniform_items_category_id_idx ON public.uniform_items(category_id);

-- =========================================================
-- SEED INITIAL CATEGORIES
-- =========================================================
INSERT INTO public.uniform_categories (name, description, sort_order) VALUES
  ('Youth', 'CDM Youth uniforms', 1),
  ('YACA', 'Youth for Africa Catholic Action', 2),
  ('CWA', 'Catholic Women Association', 3),
  ('CMA', 'Catholic Men Association', 4),
  ('PMC', 'Parish Maintenance Committee', 5)
ON CONFLICT (name) DO NOTHING;

-- =========================================================
-- VIEW: UNIFORM_ITEMS_WITH_CATEGORY
-- =========================================================
CREATE OR REPLACE VIEW public.uniform_items_with_category AS
SELECT
  ui.*,
  uc.name as category_name
FROM public.uniform_items ui
LEFT JOIN public.uniform_categories uc ON ui.category_id = uc.id
ORDER BY uc.sort_order, ui.name;

-- =========================================================
-- COMMENTS & USAGE
-- =========================================================
-- Categories are now managed in a separate table for flexibility.
-- Add new categories with:
-- INSERT INTO uniform_categories (name, description, sort_order)
-- VALUES ('New Category', 'Description', 6);
--
-- Query items by category:
-- SELECT * FROM uniform_items_with_category WHERE category_name = 'Youth';
