-- =========================================================
-- Fix Finance Config RLS Policies
-- Add write policies for master data tables
-- =========================================================

-- Drop old read-only policies
DROP POLICY IF EXISTS "parish_classes_read" ON public.parish_classes;
DROP POLICY IF EXISTS "financial_categories_read" ON public.financial_categories;
DROP POLICY IF EXISTS "event_rates_read" ON public.event_rates;
DROP POLICY IF EXISTS "enrollment_rates_read" ON public.enrollment_rates;
DROP POLICY IF EXISTS "projects_read" ON public.projects;
DROP POLICY IF EXISTS "project_class_allocations_read" ON public.project_class_allocations;

-- Create new policies allowing R/W for authenticated users
-- Role/permission checks are enforced at the application layer
CREATE POLICY "parish_classes_all" ON public.parish_classes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "financial_categories_all" ON public.financial_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "event_rates_all" ON public.event_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "enrollment_rates_all" ON public.enrollment_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "projects_all" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "project_class_allocations_all" ON public.project_class_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);
