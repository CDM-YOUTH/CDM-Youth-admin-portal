-- =========================================================
-- Uniform Orders: Support for walk-in and flexible linking
-- Allow orders from youth, patronage, or walk-in customers
-- =========================================================

ALTER TABLE public.uniform_orders
ADD COLUMN IF NOT EXISTS ordered_by_name text,
ADD COLUMN IF NOT EXISTS ordered_by_phone text,
ADD COLUMN IF NOT EXISTS ordered_for_name text,
ADD COLUMN IF NOT EXISTS deanery_id uuid REFERENCES public.deaneries(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'youth' CHECK (order_type IN ('youth', 'patronage', 'walk_in'));

CREATE INDEX IF NOT EXISTS uniform_orders_order_type_idx ON public.uniform_orders(order_type);
CREATE INDEX IF NOT EXISTS uniform_orders_ordered_by_name_idx ON public.uniform_orders(ordered_by_name);
CREATE INDEX IF NOT EXISTS uniform_orders_deanery_id_idx ON public.uniform_orders(deanery_id);

-- =========================================================
-- COMMENTS & USAGE
-- =========================================================
-- order_type: categorizes the order source
--   - 'youth': linked to youth via youth_id/cdm_id
--   - 'patronage': linked to patronage member (via patronage fields)
--   - 'walk_in': walk-in customer with manual entry
--
-- For walk-in orders:
--   - ordered_for_name: who the order is for (e.g. "John Kamau")
--   - ordered_by_name: who placed/ordered it (e.g. "Mary Wanjiru, parish rep")
--   - ordered_by_phone: contact for the person who ordered
--   - deanery_id: location (instead of joining through youth's parish)
--   - youth_id, cdm_id, parish_id remain NULL
--
-- Example walk-in:
-- INSERT INTO uniform_orders (
--   item_name, quantity, unit_price,
--   ordered_for_name, ordered_by_name, ordered_by_phone,
--   deanery_id, parish_name,
--   order_type, order_number, ordered_at, status, payment_status
-- ) VALUES (
--   'T-Shirt — Green', 5, 450,
--   'Parish youth group', 'Fr. David', '+254700111222',
--   deanery_id, 'Kagio',
--   'walk_in', 'ORD-2026-00042', now(), 'pending', 'pending'
-- );
