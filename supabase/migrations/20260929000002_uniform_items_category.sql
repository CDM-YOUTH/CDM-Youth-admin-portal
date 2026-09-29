-- =========================================================
-- Uniform Items: Add category field
-- Support multiple uniform categories (youth, sewing, organizations, etc)
-- =========================================================

ALTER TABLE public.uniform_items
ADD COLUMN IF NOT EXISTS category text DEFAULT 'youth' CHECK (category IN ('youth', 'sewing', 'organization', 'other'));

CREATE INDEX IF NOT EXISTS uniform_items_category_idx ON public.uniform_items(category);

-- =========================================================
-- UNIFORM_ITEMS_BY_CATEGORY VIEW
-- =========================================================
CREATE OR REPLACE VIEW public.uniform_items_by_category AS
SELECT
  category,
  COUNT(*) as item_count,
  SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) as active_items
FROM public.uniform_items
GROUP BY category;

-- =========================================================
-- COMMENTS & USAGE
-- =========================================================
-- Categories:
--   - 'youth': CDM youth uniforms (T-shirts, caps, sashes, etc)
--   - 'sewing': Sewing services, training materials
--   - 'organization': Uniforms for other organizations, churches, groups
--   - 'other': Miscellaneous items
--
-- Example:
-- INSERT INTO uniform_items (name, category, unit_price)
-- VALUES ('Training Kit', 'sewing', 800);
--
-- SELECT * FROM uniform_items WHERE category = 'sewing';
