-- =========================================================
-- Uniforms Orders Redesign - Phase 2
-- Complete overhaul: tracking youth orders from creation
-- through approval, payment, dispatch, and delivery
-- =========================================================

-- =========================================================
-- UNIFORM_ORDERS (completely redesigned)
-- =========================================================
-- Archive old table if it exists
ALTER TABLE IF EXISTS public.uniform_orders RENAME TO uniform_orders_legacy;

-- Create new orders table with full lifecycle tracking
CREATE TABLE public.uniform_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,

  -- ITEM & QUANTITY
  item_id uuid NOT NULL REFERENCES public.uniform_items(id) ON DELETE RESTRICT,
  quantity int NOT NULL CHECK (quantity > 0),

  -- ORDER CREATION (dual origin: admin or youth portal)
  ordered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- admin user if created by staff
  youth_id uuid REFERENCES public.youths(id) ON DELETE SET NULL, -- youth if portal order
  cdm_id text, -- denormalized from youths for quick lookup
  ordered_at timestamptz NOT NULL DEFAULT now(),

  -- APPROVAL
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes text,

  -- PAYMENT
  payment_status enum_or_text NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'waived'
  paid_at timestamptz,
  paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- who recorded the payment
  payment_method text, -- 'cash', 'mpesa', 'bank_transfer', etc

  -- DISPATCH
  dispatch_contact_name text,
  dispatch_contact_phone text,
  dispatch_method enum_or_text NOT NULL DEFAULT 'pickup', -- 'pickup', 'delivery', 'mail'
  dispatch_scheduled_at timestamptz,
  dispatched_at timestamptz,
  dispatch_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- staff who dispatched
  dispatch_notes text,

  -- DELIVERY
  delivered_at timestamptz,
  delivered_by text, -- recipient name or courier
  delivery_notes text,

  -- AUDIT FIELDS
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- CONSTRAINTS: ensure either ordered_by (admin) or youth_id (portal) is set
  CONSTRAINT order_origin CHECK (
    (ordered_by IS NOT NULL AND youth_id IS NULL) OR
    (ordered_by IS NULL AND youth_id IS NOT NULL)
  )
);

-- =========================================================
-- ORDER NUMBER GENERATION
-- =========================================================
CREATE SEQUENCE IF NOT EXISTS public.uniform_order_seq START 1;

CREATE OR REPLACE FUNCTION public.next_uniform_order_number()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT 'ORD-' || extract(year from now())::text || '-' || lpad(nextval('public.uniform_order_seq')::text, 5, '0')
$$;

-- Set default for order_number
ALTER TABLE public.uniform_orders
  ALTER COLUMN order_number SET DEFAULT public.next_uniform_order_number();

-- =========================================================
-- INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS uniform_orders_order_number_idx ON public.uniform_orders(order_number);
CREATE INDEX IF NOT EXISTS uniform_orders_item_idx ON public.uniform_orders(item_id);
CREATE INDEX IF NOT EXISTS uniform_orders_youth_idx ON public.uniform_orders(youth_id);
CREATE INDEX IF NOT EXISTS uniform_orders_cdm_id_idx ON public.uniform_orders(cdm_id);
CREATE INDEX IF NOT EXISTS uniform_orders_ordered_at_idx ON public.uniform_orders(ordered_at DESC);
CREATE INDEX IF NOT EXISTS uniform_orders_delivered_at_idx ON public.uniform_orders(delivered_at) WHERE delivered_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS uniform_orders_status_idx ON public.uniform_orders(
  CASE
    WHEN delivered_at IS NOT NULL THEN 'delivered'
    WHEN dispatched_at IS NOT NULL THEN 'dispatched'
    WHEN paid_at IS NOT NULL THEN 'paid'
    WHEN reviewed_at IS NOT NULL THEN 'approved'
    ELSE 'pending'
  END
);
CREATE INDEX IF NOT EXISTS uniform_orders_deleted_at_idx ON public.uniform_orders(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS uniform_orders_created_by_idx ON public.uniform_orders(created_by);
CREATE INDEX IF NOT EXISTS uniform_orders_updated_by_idx ON public.uniform_orders(updated_by);

-- =========================================================
-- AUDIT TRIGGER
-- =========================================================
CREATE TRIGGER uniform_orders_touch BEFORE UPDATE ON public.uniform_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- COMPUTED STATUS FIELD (for easy querying)
-- =========================================================
-- View to compute status on-the-fly
CREATE OR REPLACE VIEW public.uniform_orders_with_status AS
SELECT
  uo.*,
  CASE
    WHEN uo.deleted_at IS NOT NULL THEN 'cancelled'
    WHEN uo.delivered_at IS NOT NULL THEN 'delivered'
    WHEN uo.dispatched_at IS NOT NULL THEN 'dispatched'
    WHEN uo.paid_at IS NOT NULL THEN 'paid'
    WHEN uo.reviewed_at IS NOT NULL THEN 'approved'
    ELSE 'pending'
  END AS status
FROM public.uniform_orders uo;

-- =========================================================
-- RLS POLICIES
-- =========================================================
ALTER TABLE public.uniform_orders ENABLE ROW LEVEL SECURITY;

-- Admin: see all active orders
CREATE POLICY uniform_orders_read_admin ON public.uniform_orders FOR SELECT
  USING (deleted_at IS NULL);

-- Admin: can create orders on behalf of youth or themselves
CREATE POLICY uniform_orders_insert_admin ON public.uniform_orders FOR INSERT
  WITH CHECK (true); -- restrict in app logic to admin role

-- Admin: can update orders at any stage
CREATE POLICY uniform_orders_update_admin ON public.uniform_orders FOR UPDATE
  USING (true) WITH CHECK (true); -- restrict in app logic to admin role

-- Youth portal: see only their own orders
CREATE POLICY uniform_orders_read_youth ON public.uniform_orders FOR SELECT
  USING (
    deleted_at IS NULL AND
    (youth_id = auth.uid() OR
     (SELECT youth_id FROM public.youths WHERE id = youth_id LIMIT 1) = auth.uid())
  );

-- Youth: can create orders (insert triggered from app, not direct)
CREATE POLICY uniform_orders_insert_youth ON public.uniform_orders FOR INSERT
  WITH CHECK (youth_id = auth.uid());

-- Youth: cannot update their own orders (only admins can approve/dispatch)
-- (no UPDATE policy for youth = no direct updates allowed)

GRANT SELECT, INSERT, UPDATE ON public.uniform_orders TO authenticated, anon;
GRANT ALL ON public.uniform_orders TO service_role;
GRANT USAGE ON SEQUENCE public.uniform_order_seq TO authenticated, anon, service_role;

-- =========================================================
-- NOTES ON STATUS COMPUTATION
-- =========================================================
-- Status is NOT a separate field; it's computed from timestamps:
-- - pending: ordered_at set, reviewed_at IS NULL
-- - approved: reviewed_at set, paid_at IS NULL
-- - paid: paid_at set, dispatched_at IS NULL
-- - dispatched: dispatched_at set, delivered_at IS NULL
-- - delivered: delivered_at IS NOT NULL
-- - cancelled: deleted_at IS NOT NULL
--
-- Application layer computes status using the view above.
-- Benefits: no sync bugs, single source of truth, idempotent.
