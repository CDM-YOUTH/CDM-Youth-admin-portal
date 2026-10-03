-- =========================================================
-- Financial Ledger Module
-- Centralized finance management for youth office
-- =========================================================

-- =========================================================
-- FINANCIAL_CATEGORIES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.financial_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('event', 'project', 'enrollment')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS financial_categories_type_idx ON public.financial_categories(type);
CREATE INDEX IF NOT EXISTS financial_categories_is_active_idx ON public.financial_categories(is_active);

-- =========================================================
-- PARISH_ASSESSMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.parish_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parish_id uuid NOT NULL REFERENCES public.parishes(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.financial_categories(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL,
  headcount integer, -- Used exclusively for enrollment categories (headcount * 100)
  amount_due numeric(12, 2) NOT NULL DEFAULT 0,
  is_historical_arrears boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(parish_id, category_id, fiscal_year)
);

CREATE INDEX IF NOT EXISTS parish_assessments_parish_idx ON public.parish_assessments(parish_id);
CREATE INDEX IF NOT EXISTS parish_assessments_category_idx ON public.parish_assessments(category_id);
CREATE INDEX IF NOT EXISTS parish_assessments_fiscal_year_idx ON public.parish_assessments(fiscal_year);
CREATE INDEX IF NOT EXISTS parish_assessments_is_historical_idx ON public.parish_assessments(is_historical_arrears);

-- =========================================================
-- PARISH_PAYMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.parish_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parish_id uuid NOT NULL REFERENCES public.parishes(id) ON DELETE CASCADE,
  amount_paid numeric(12, 2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cheque', 'bank_deposit', 'cash')),
  reference_number text,
  payment_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS parish_payments_parish_idx ON public.parish_payments(parish_id);
CREATE INDEX IF NOT EXISTS parish_payments_payment_date_idx ON public.parish_payments(payment_date);
CREATE INDEX IF NOT EXISTS parish_payments_payment_method_idx ON public.parish_payments(payment_method);

-- =========================================================
-- PAYMENT_ALLOCATIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.parish_payments(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.parish_assessments(id) ON DELETE CASCADE,
  allocated_amount numeric(12, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS payment_allocations_payment_idx ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS payment_allocations_assessment_idx ON public.payment_allocations(assessment_id);

-- =========================================================
-- Update triggers
-- =========================================================
DROP TRIGGER IF EXISTS financial_categories_touch ON public.financial_categories;
CREATE TRIGGER financial_categories_touch BEFORE UPDATE ON public.financial_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS parish_assessments_touch ON public.parish_assessments;
CREATE TRIGGER parish_assessments_touch BEFORE UPDATE ON public.parish_assessments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS parish_payments_touch ON public.parish_payments;
CREATE TRIGGER parish_payments_touch BEFORE UPDATE ON public.parish_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS payment_allocations_touch ON public.payment_allocations;
CREATE TRIGGER payment_allocations_touch BEFORE UPDATE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- RLS Policies
-- =========================================================
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parish_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parish_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all financial categories
CREATE POLICY "financial_categories_read" ON public.financial_categories
  FOR SELECT TO authenticated
  USING (true);

-- Allow authenticated users with appropriate role to manage categories
CREATE POLICY "financial_categories_write" ON public.financial_categories
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "financial_categories_update" ON public.financial_categories
  FOR UPDATE TO authenticated
  USING (true);

-- Parish assessments: scoped by parish location via can_access
CREATE POLICY "parish_assessments_read" ON public.parish_assessments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parishes p
      WHERE p.id = parish_id
      AND public.can_access('finances', 'view', p.deanery_id, p.id, NULL)
    )
  );

CREATE POLICY "parish_assessments_write" ON public.parish_assessments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parishes p
      WHERE p.id = parish_id
      AND public.can_access('finances', 'create', p.deanery_id, p.id, NULL)
    )
  );

CREATE POLICY "parish_assessments_update" ON public.parish_assessments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parishes p
      WHERE p.id = parish_id
      AND public.can_access('finances', 'edit', p.deanery_id, p.id, NULL)
    )
  );

-- Parish payments: scoped by parish location via can_access
CREATE POLICY "parish_payments_read" ON public.parish_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parishes p
      WHERE p.id = parish_id
      AND public.can_access('finances', 'view', p.deanery_id, p.id, NULL)
    )
  );

CREATE POLICY "parish_payments_write" ON public.parish_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parishes p
      WHERE p.id = parish_id
      AND public.can_access('finances', 'create', p.deanery_id, p.id, NULL)
    )
  );

CREATE POLICY "parish_payments_update" ON public.parish_payments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parishes p
      WHERE p.id = parish_id
      AND public.can_access('finances', 'edit', p.deanery_id, p.id, NULL)
    )
  );

-- Payment allocations: inherited through payment, check access via parish
CREATE POLICY "payment_allocations_read" ON public.payment_allocations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parish_payments pp
      JOIN public.parishes p ON p.id = pp.parish_id
      WHERE pp.id = payment_id
      AND public.can_access('finances', 'view', p.deanery_id, p.id, NULL)
    )
  );

CREATE POLICY "payment_allocations_write" ON public.payment_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parish_payments pp
      JOIN public.parishes p ON p.id = pp.parish_id
      WHERE pp.id = payment_id
      AND public.can_access('finances', 'create', p.deanery_id, p.id, NULL)
    )
  );

CREATE POLICY "payment_allocations_update" ON public.payment_allocations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parish_payments pp
      JOIN public.parishes p ON p.id = pp.parish_id
      WHERE pp.id = payment_id
      AND public.can_access('finances', 'edit', p.deanery_id, p.id, NULL)
    )
  );

-- =========================================================
-- Seed Initial Categories
-- =========================================================
INSERT INTO public.financial_categories (name, type) VALUES
  ('Bishop''s Visit', 'event'),
  ('Patronage Day', 'event'),
  ('Youth Day', 'event'),
  ('CUSA Mass', 'event'),
  ('Ball Games', 'event'),
  ('Kagio Project', 'project'),
  ('Annual Enrollment Fee', 'enrollment')
ON CONFLICT (name) DO NOTHING;
