-- ============================================================
-- Welfare Cases
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS public.welfare_serial START 1;

DROP TYPE IF EXISTS public.welfare_urgency CASCADE;
DROP TYPE IF EXISTS public.welfare_status  CASCADE;
CREATE TYPE public.welfare_urgency AS ENUM ('low','medium','high');
CREATE TYPE public.welfare_status  AS ENUM ('open','in_progress','resolved','closed');

DROP TABLE IF EXISTS public.welfare_cases CASCADE;
CREATE TABLE public.welfare_cases (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_ref     text        NOT NULL UNIQUE
                             DEFAULT ('WF-' || extract(year from now())::text || '-'
                                      || lpad(nextval('public.welfare_serial')::text, 3, '0')),
  category     text        NOT NULL,
  urgency      public.welfare_urgency NOT NULL DEFAULT 'medium',
  status       public.welfare_status  NOT NULL DEFAULT 'open',
  parish_id    uuid        REFERENCES public.parishes(id)  ON DELETE SET NULL,
  parish_name  text,
  youth_id     uuid        REFERENCES public.youths(id)    ON DELETE SET NULL,
  cdm_id       text,
  assigned_to  text,
  notes        text,
  opened_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  created_by   uuid        REFERENCES auth.users(id)       ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS welfare_cases_status_idx  ON public.welfare_cases(status);
CREATE INDEX IF NOT EXISTS welfare_cases_urgency_idx ON public.welfare_cases(urgency);
CREATE INDEX IF NOT EXISTS welfare_cases_parish_idx  ON public.welfare_cases(parish_id);

DROP TRIGGER IF EXISTS welfare_cases_touch ON public.welfare_cases;
CREATE TRIGGER welfare_cases_touch
  BEFORE UPDATE ON public.welfare_cases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.welfare_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wc_read"   ON public.welfare_cases;
DROP POLICY IF EXISTS "wc_insert" ON public.welfare_cases;
DROP POLICY IF EXISTS "wc_update" ON public.welfare_cases;
DROP POLICY IF EXISTS "wc_delete" ON public.welfare_cases;
CREATE POLICY "wc_read"   ON public.welfare_cases FOR SELECT USING (true);
CREATE POLICY "wc_insert" ON public.welfare_cases FOR INSERT WITH CHECK (true);
CREATE POLICY "wc_update" ON public.welfare_cases FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "wc_delete" ON public.welfare_cases FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.welfare_cases TO authenticated, anon;
GRANT ALL                             ON public.welfare_cases TO service_role;
GRANT USAGE ON SEQUENCE public.welfare_serial TO authenticated, anon, service_role;

-- ============================================================
-- Uniform SKUs
-- ============================================================

DROP TABLE IF EXISTS public.uniform_orders CASCADE;
DROP TABLE IF EXISTS public.uniform_skus   CASCADE;
CREATE TABLE public.uniform_skus (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL UNIQUE,
  swatch     text,
  in_stock   int         NOT NULL DEFAULT 0,
  on_order   int         NOT NULL DEFAULT 0,
  unit_price numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS uniform_skus_touch ON public.uniform_skus;
CREATE TRIGGER uniform_skus_touch
  BEFORE UPDATE ON public.uniform_skus
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.uniform_skus ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sku_read"   ON public.uniform_skus;
DROP POLICY IF EXISTS "sku_insert" ON public.uniform_skus;
DROP POLICY IF EXISTS "sku_update" ON public.uniform_skus;
DROP POLICY IF EXISTS "sku_delete" ON public.uniform_skus;
CREATE POLICY "sku_read"   ON public.uniform_skus FOR SELECT USING (true);
CREATE POLICY "sku_insert" ON public.uniform_skus FOR INSERT WITH CHECK (true);
CREATE POLICY "sku_update" ON public.uniform_skus FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "sku_delete" ON public.uniform_skus FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uniform_skus TO authenticated, anon;
GRANT ALL                             ON public.uniform_skus TO service_role;

INSERT INTO public.uniform_skus (name, swatch, in_stock, on_order) VALUES
  ('T-Shirt — Green',     'var(--color-success)', 480, 200),
  ('T-Shirt — Gold',      'var(--color-gold)',    120, 350),
  ('Cap — Embroidered',   'var(--color-bg-4)',    240, 100),
  ('Sash — Mission Week', 'var(--color-danger)',   60, 180)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Uniform Orders
-- ============================================================

DROP TYPE IF EXISTS public.order_status CASCADE;
CREATE TYPE public.order_status AS ENUM ('pending','ordered','received','cancelled');

CREATE TABLE public.uniform_orders (
  id                 uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id             uuid                REFERENCES public.uniform_skus(id) ON DELETE SET NULL,
  item_name          text                NOT NULL,
  quantity           int                 NOT NULL CHECK (quantity > 0),
  supplier           text,
  deanery_id         uuid                REFERENCES public.deaneries(id) ON DELETE SET NULL,
  deanery_name       text,
  estimated_delivery date,
  status             public.order_status NOT NULL DEFAULT 'pending',
  notes              text,
  ordered_by         uuid                REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz         NOT NULL DEFAULT now(),
  updated_at         timestamptz         NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uniform_orders_sku_idx    ON public.uniform_orders(sku_id);
CREATE INDEX IF NOT EXISTS uniform_orders_status_idx ON public.uniform_orders(status);

DROP TRIGGER IF EXISTS uniform_orders_touch ON public.uniform_orders;
CREATE TRIGGER uniform_orders_touch
  BEFORE UPDATE ON public.uniform_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.uniform_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "uo_read"   ON public.uniform_orders;
DROP POLICY IF EXISTS "uo_insert" ON public.uniform_orders;
DROP POLICY IF EXISTS "uo_update" ON public.uniform_orders;
DROP POLICY IF EXISTS "uo_delete" ON public.uniform_orders;
CREATE POLICY "uo_read"   ON public.uniform_orders FOR SELECT USING (true);
CREATE POLICY "uo_insert" ON public.uniform_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "uo_update" ON public.uniform_orders FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "uo_delete" ON public.uniform_orders FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uniform_orders TO authenticated, anon;
GRANT ALL                             ON public.uniform_orders TO service_role;

-- ============================================================
-- Formation Library
-- ============================================================

DROP TYPE IF EXISTS public.formation_kind CASCADE;
CREATE TYPE public.formation_kind AS ENUM ('PDF','Audio','Video','Image','Other');

DROP TABLE IF EXISTS public.formation_items CASCADE;
CREATE TABLE public.formation_items (
  id           uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text                  NOT NULL,
  kind         public.formation_kind NOT NULL DEFAULT 'PDF',
  duration     text,
  author       text,
  tags         text[]                NOT NULL DEFAULT '{}',
  description  text,
  file_url     text,
  views        int                   NOT NULL DEFAULT 0,
  published    boolean               NOT NULL DEFAULT true,
  published_by uuid                  REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz           NOT NULL DEFAULT now(),
  updated_at   timestamptz           NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS formation_items_kind_idx      ON public.formation_items(kind);
CREATE INDEX IF NOT EXISTS formation_items_published_idx ON public.formation_items(published);

DROP TRIGGER IF EXISTS formation_items_touch ON public.formation_items;
CREATE TRIGGER formation_items_touch
  BEFORE UPDATE ON public.formation_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.formation_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fi_read"   ON public.formation_items;
DROP POLICY IF EXISTS "fi_insert" ON public.formation_items;
DROP POLICY IF EXISTS "fi_update" ON public.formation_items;
DROP POLICY IF EXISTS "fi_delete" ON public.formation_items;
CREATE POLICY "fi_read"   ON public.formation_items FOR SELECT USING (true);
CREATE POLICY "fi_insert" ON public.formation_items FOR INSERT WITH CHECK (true);
CREATE POLICY "fi_update" ON public.formation_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "fi_delete" ON public.formation_items FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.formation_items TO authenticated, anon;
GRANT ALL                             ON public.formation_items TO service_role;

INSERT INTO public.formation_items (title, kind, duration, views) VALUES
  ('Lent Reflection — Week 4',   'Audio', '12 min',   482),
  ('Catechism: The Eucharist',    'PDF',   '24 pages', 1204),
  ('Youth Bible Study — John 3',  'Video', '18 min',   728),
  ('Vocations Discernment Guide', 'PDF',   '16 pages', 384),
  ('Mission Week Prayer Booklet', 'PDF',   '8 pages',  612)
ON CONFLICT DO NOTHING;
