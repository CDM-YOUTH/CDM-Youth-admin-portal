-- ============================================================
-- Uniform Sales — individual sales to youths
-- Tracks: who ordered, when delivered, when paid, how much
-- ============================================================

DROP TYPE IF EXISTS public.uniform_payment_status CASCADE;
CREATE TYPE public.uniform_payment_status AS ENUM ('unpaid', 'partial', 'paid');

DROP TABLE IF EXISTS public.uniform_sales CASCADE;
CREATE TABLE public.uniform_sales (
  id               uuid                           PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id           uuid                           REFERENCES public.uniform_skus(id) ON DELETE SET NULL,
  item_name        text                           NOT NULL,
  youth_name       text                           NOT NULL,
  parish_name      text,
  quantity         int                            NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price       numeric(10,2)                  NOT NULL DEFAULT 0,
  ordered_at       timestamptz                    NOT NULL DEFAULT now(),
  delivered_at     timestamptz,
  paid_at          timestamptz,
  paid_amount      numeric(10,2)                  NOT NULL DEFAULT 0,
  payment_status   public.uniform_payment_status  NOT NULL DEFAULT 'unpaid',
  notes            text,
  created_at       timestamptz                    NOT NULL DEFAULT now(),
  updated_at       timestamptz                    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uniform_sales_sku_idx     ON public.uniform_sales(sku_id);
CREATE INDEX IF NOT EXISTS uniform_sales_ordered_idx ON public.uniform_sales(ordered_at DESC);
CREATE INDEX IF NOT EXISTS uniform_sales_payment_idx ON public.uniform_sales(payment_status);

DROP TRIGGER IF EXISTS uniform_sales_touch ON public.uniform_sales;
CREATE TRIGGER uniform_sales_touch
  BEFORE UPDATE ON public.uniform_sales
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.uniform_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "us_read"   ON public.uniform_sales;
DROP POLICY IF EXISTS "us_insert" ON public.uniform_sales;
DROP POLICY IF EXISTS "us_update" ON public.uniform_sales;
DROP POLICY IF EXISTS "us_delete" ON public.uniform_sales;
CREATE POLICY "us_read"   ON public.uniform_sales FOR SELECT USING (true);
CREATE POLICY "us_insert" ON public.uniform_sales FOR INSERT WITH CHECK (true);
CREATE POLICY "us_update" ON public.uniform_sales FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "us_delete" ON public.uniform_sales FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uniform_sales TO authenticated, anon;
GRANT ALL                             ON public.uniform_sales TO service_role;
