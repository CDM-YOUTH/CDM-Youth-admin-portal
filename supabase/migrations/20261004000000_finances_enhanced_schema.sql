-- =========================================================
-- Enhanced Finance Schema v2
-- Parish classes, tiered projects, yearly events
-- =========================================================

-- =========================================================
-- PARISH_CLASSES (Tiers for project allocation)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.parish_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name text NOT NULL UNIQUE,
  description text,
  sort_order integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS parish_classes_active_idx ON public.parish_classes(is_active);
CREATE INDEX IF NOT EXISTS parish_classes_sort_idx ON public.parish_classes(sort_order);

-- =========================================================
-- Update PARISHES: Add class assignment
-- =========================================================
ALTER TABLE public.parishes
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.parish_classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS parishes_class_idx ON public.parishes(class_id);

-- =========================================================
-- FINANCIAL_CATEGORIES (Events + Enrollment) - Enhanced
-- =========================================================
-- Migrate from old schema if it exists
DROP TABLE IF EXISTS public.financial_categories CASCADE;

CREATE TABLE IF NOT EXISTS public.financial_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('event', 'enrollment')),
  fiscal_year integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(name, fiscal_year, type)
);

CREATE INDEX IF NOT EXISTS financial_categories_type_idx ON public.financial_categories(type);
CREATE INDEX IF NOT EXISTS financial_categories_year_idx ON public.financial_categories(fiscal_year);
CREATE INDEX IF NOT EXISTS financial_categories_active_idx ON public.financial_categories(is_active);

-- =========================================================
-- EVENT_RATES (Yearly event amounts)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.event_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.financial_categories(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL,
  amount_due numeric(12, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(category_id, fiscal_year)
);

CREATE INDEX IF NOT EXISTS event_rates_category_idx ON public.event_rates(category_id);
CREATE INDEX IF NOT EXISTS event_rates_year_idx ON public.event_rates(fiscal_year);

-- =========================================================
-- ENROLLMENT_RATES (Yearly per-member rates)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.enrollment_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year integer NOT NULL UNIQUE,
  amount_per_member numeric(12, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS enrollment_rates_year_idx ON public.enrollment_rates(fiscal_year);

-- =========================================================
-- PROJECTS (Multi-year capital initiatives)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS projects_status_idx ON public.projects(status);
CREATE INDEX IF NOT EXISTS projects_active_idx ON public.projects(is_active);

-- =========================================================
-- PROJECT_CLASS_ALLOCATIONS (Matrix: Project × Class × Year)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.project_class_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.parish_classes(id) ON DELETE CASCADE,
  allocation_year integer NOT NULL,
  amount_allocated numeric(12, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(project_id, class_id, allocation_year)
);

CREATE INDEX IF NOT EXISTS project_class_alloc_project_idx ON public.project_class_allocations(project_id);
CREATE INDEX IF NOT EXISTS project_class_alloc_class_idx ON public.project_class_allocations(class_id);
CREATE INDEX IF NOT EXISTS project_class_alloc_year_idx ON public.project_class_allocations(allocation_year);

-- =========================================================
-- PARISH_PAYMENTS & PAYMENT_ALLOCATIONS
-- =========================================================
-- Clean up old schema if it exists (do this FIRST)
DROP TABLE IF EXISTS public.payment_allocations CASCADE;
DROP TABLE IF EXISTS public.parish_payments CASCADE;
DROP TABLE IF EXISTS public.parish_assessments CASCADE;

-- =========================================================
-- PARISH_ASSESSMENTS (Invoices/obligations per parish)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.parish_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parish_id uuid NOT NULL REFERENCES public.parishes(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.financial_categories(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL,
  headcount integer,
  amount_due numeric(12, 2) NOT NULL DEFAULT 0,
  is_historical_arrears boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS parish_assessments_parish_idx ON public.parish_assessments(parish_id);
CREATE INDEX IF NOT EXISTS parish_assessments_category_idx ON public.parish_assessments(category_id);
CREATE INDEX IF NOT EXISTS parish_assessments_project_idx ON public.parish_assessments(project_id);
CREATE INDEX IF NOT EXISTS parish_assessments_year_idx ON public.parish_assessments(fiscal_year);

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
-- Update Triggers
-- =========================================================
DROP TRIGGER IF EXISTS parish_classes_touch ON public.parish_classes;
CREATE TRIGGER parish_classes_touch BEFORE UPDATE ON public.parish_classes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS financial_categories_touch ON public.financial_categories;
CREATE TRIGGER financial_categories_touch BEFORE UPDATE ON public.financial_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS event_rates_touch ON public.event_rates;
CREATE TRIGGER event_rates_touch BEFORE UPDATE ON public.event_rates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS enrollment_rates_touch ON public.enrollment_rates;
CREATE TRIGGER enrollment_rates_touch BEFORE UPDATE ON public.enrollment_rates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS projects_touch ON public.projects;
CREATE TRIGGER projects_touch BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS project_class_allocations_touch ON public.project_class_allocations;
CREATE TRIGGER project_class_allocations_touch BEFORE UPDATE ON public.project_class_allocations
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
-- RLS Policies (Org-scoped access)
-- =========================================================
ALTER TABLE public.parish_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_class_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parish_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parish_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- Master data tables: allow authenticated users full R/W access (role checks in app layer)
CREATE POLICY "parish_classes_all" ON public.parish_classes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "financial_categories_all" ON public.financial_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "event_rates_all" ON public.event_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "enrollment_rates_all" ON public.enrollment_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "projects_all" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "project_class_allocations_all" ON public.project_class_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Parish assessments & payments: scoped by parish via can_access
CREATE POLICY "parish_assessments_read" ON public.parish_assessments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parishes p
      WHERE p.id = parish_id
      AND public.can_access('finances', 'view', p.deanery_id, p.id, NULL)
    )
  );

CREATE POLICY "parish_assessments_write" ON public.parish_assessments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parishes p
      WHERE p.id = parish_id
      AND public.can_access('finances', 'create', p.deanery_id, p.id, NULL)
    )
  );

CREATE POLICY "parish_payments_read" ON public.parish_payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parishes p
      WHERE p.id = parish_id
      AND public.can_access('finances', 'view', p.deanery_id, p.id, NULL)
    )
  );

CREATE POLICY "parish_payments_write" ON public.parish_payments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parishes p
      WHERE p.id = parish_id
      AND public.can_access('finances', 'create', p.deanery_id, p.id, NULL)
    )
  );

CREATE POLICY "payment_allocations_read" ON public.payment_allocations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parish_payments pp
      JOIN public.parishes p ON p.id = pp.parish_id
      WHERE pp.id = payment_id
      AND public.can_access('finances', 'view', p.deanery_id, p.id, NULL)
    )
  );

-- =========================================================
-- Seed Initial Data
-- =========================================================
INSERT INTO public.parish_classes (class_name, description, sort_order) VALUES
  ('Class A', 'Large/Urban parishes', 1),
  ('Class B', 'Medium parishes', 2),
  ('Class C', 'Small/Rural parishes', 3)
ON CONFLICT (class_name) DO NOTHING;

INSERT INTO public.enrollment_rates (fiscal_year, amount_per_member) VALUES
  (2026, 100.00),
  (2027, 100.00)
ON CONFLICT (fiscal_year) DO NOTHING;
