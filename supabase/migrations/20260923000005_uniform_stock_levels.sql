-- =========================================================
-- Uniform Stock Levels View
-- Real-time calculation: stock_in - delivered_orders
-- =========================================================

-- =========================================================
-- UNIFORM_STOCK_LEVELS VIEW
-- =========================================================
-- Shows available stock for each item calculated from:
-- 1. SUM of all stock entries (inbound)
-- 2. MINUS SUM of delivered youth orders (outbound)
-- 3. Result = available_stock for ordering

CREATE OR REPLACE VIEW public.uniform_stock_levels AS
SELECT
  ui.id,
  ui.name,
  ui.swatch,
  ui.unit_price,
  COALESCE(SUM(CASE WHEN use.deleted_at IS NULL THEN use.quantity ELSE 0 END), 0) AS stock_in,
  COALESCE(SUM(CASE WHEN uo.delivered_at IS NOT NULL THEN uo.quantity ELSE 0 END), 0) AS stock_out_delivered,
  COALESCE(SUM(CASE WHEN uo.delivered_at IS NOT NULL THEN uo.quantity ELSE 0 END), 0) AS pending_youth_orders,
  (
    COALESCE(SUM(CASE WHEN use.deleted_at IS NULL THEN use.quantity ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN uo.delivered_at IS NOT NULL THEN uo.quantity ELSE 0 END), 0)
  ) AS available_stock
FROM public.uniform_items ui
LEFT JOIN public.uniform_stock_entries use ON ui.id = use.item_id
LEFT JOIN public.uniform_orders uo ON ui.id = uo.item_id AND uo.deleted_at IS NULL
GROUP BY ui.id, ui.name, ui.swatch, ui.unit_price
ORDER BY ui.name;

-- =========================================================
-- UNIFORM_ITEMS_WITH_STOCK VIEW (convenience view)
-- =========================================================
-- Join uniform_items with current stock levels
CREATE OR REPLACE VIEW public.uniform_items_with_stock AS
SELECT
  ui.*,
  COALESCE(usl.stock_in, 0) AS stock_in,
  COALESCE(usl.stock_out_delivered, 0) AS stock_out_delivered,
  COALESCE(usl.pending_youth_orders, 0) AS pending_youth_orders,
  COALESCE(usl.available_stock, 0) AS available_stock
FROM public.uniform_items ui
LEFT JOIN public.uniform_stock_levels usl ON ui.id = usl.id;

-- =========================================================
-- COMMENTS FOR CLARITY
-- =========================================================
-- stock_in: total quantity added via uniform_stock_entries
-- stock_out_delivered: total quantity delivered to youth
-- pending_youth_orders: active orders not yet delivered
-- available_stock: = stock_in - stock_out_delivered
--
-- Note: pending_youth_orders is for reference only.
-- Use available_stock for determining if stock allows new orders.
--
-- To check if sufficient stock for an order:
--   SELECT available_stock FROM uniform_stock_levels WHERE id = item_id;
--   THEN check: available_stock >= order_quantity
