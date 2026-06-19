-- ============================================================
-- Uniform Stock Entries — log each sewing/production batch
-- Every time uniforms are sewn, record the event here.
-- ============================================================

DROP TABLE IF EXISTS public.uniform_stock_entries CASCADE;
CREATE TABLE public.uniform_stock_entries (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id      uuid         REFERENCES public.uniform_skus(id) ON DELETE SET NULL,
  item_name   text         NOT NULL,
  quantity    int          NOT NULL CHECK (quantity > 0),
  notes       text,
  entered_at  timestamptz  NOT NULL DEFAULT now(),
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uniform_stock_entries_sku_idx     ON public.uniform_stock_entries(sku_id);
CREATE INDEX IF NOT EXISTS uniform_stock_entries_entered_idx ON public.uniform_stock_entries(entered_at DESC);

ALTER TABLE public.uniform_stock_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "use_read"   ON public.uniform_stock_entries;
DROP POLICY IF EXISTS "use_insert" ON public.uniform_stock_entries;
DROP POLICY IF EXISTS "use_delete" ON public.uniform_stock_entries;
CREATE POLICY "use_read"   ON public.uniform_stock_entries FOR SELECT USING (true);
CREATE POLICY "use_insert" ON public.uniform_stock_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "use_delete" ON public.uniform_stock_entries FOR DELETE USING (true);

GRANT SELECT, INSERT, DELETE ON public.uniform_stock_entries TO authenticated, anon;
GRANT ALL                    ON public.uniform_stock_entries TO service_role;
