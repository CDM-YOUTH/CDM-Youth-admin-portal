-- ================================================================
-- Performance Indexes
--
-- Covers all tables used by the admin portal:
--   youths, cusa_members, enrollments, youth_leadership_roles,
--   events, welfare_cases, uniform_skus, uniform_sales
--
-- Two categories:
--   1. B-tree indexes  — exact-match filters and sort columns
--   2. GIN trgm indexes — substring text search (ilike '%term%')
--
-- pg_trgm is required for the GIN indexes.
-- ================================================================

-- Enable trigram extension (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ----------------------------------------------------------------
-- youths
-- ----------------------------------------------------------------

-- UUID filter columns (org hierarchy + category + status)
CREATE INDEX IF NOT EXISTS idx_youths_deanery_id
  ON public.youths (deanery_id);

CREATE INDEX IF NOT EXISTS idx_youths_parish_id
  ON public.youths (parish_id);

CREATE INDEX IF NOT EXISTS idx_youths_outstation_id
  ON public.youths (outstation_id);

CREATE INDEX IF NOT EXISTS idx_youths_category
  ON public.youths (category);

CREATE INDEX IF NOT EXISTS idx_youths_status
  ON public.youths (status);

-- Composite: the two most common combined filters
CREATE INDEX IF NOT EXISTS idx_youths_deanery_status
  ON public.youths (deanery_id, status);

CREATE INDEX IF NOT EXISTS idx_youths_parish_status
  ON public.youths (parish_id, status);

-- Sort column
CREATE INDEX IF NOT EXISTS idx_youths_created_at
  ON public.youths (created_at DESC);

-- Text search (full_name, cdm_id, phone)
CREATE INDEX IF NOT EXISTS idx_youths_full_name_trgm
  ON public.youths USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_youths_cdm_id_trgm
  ON public.youths USING gin (cdm_id gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_youths_phone_trgm
  ON public.youths USING gin (phone gin_trgm_ops);


-- ----------------------------------------------------------------
-- cusa_members
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_cusa_year
  ON public.cusa_members (year);

CREATE INDEX IF NOT EXISTS idx_cusa_institution
  ON public.cusa_members (institution);

CREATE INDEX IF NOT EXISTS idx_cusa_youth_id
  ON public.cusa_members (youth_id);

CREATE INDEX IF NOT EXISTS idx_cusa_year_institution
  ON public.cusa_members (year, institution);

CREATE INDEX IF NOT EXISTS idx_cusa_institution_trgm
  ON public.cusa_members USING gin (institution gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_cusa_created_at
  ON public.cusa_members (created_at DESC);


-- ----------------------------------------------------------------
-- enrollments
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_enrollments_year
  ON public.enrollments (year);

CREATE INDEX IF NOT EXISTS idx_enrollments_status
  ON public.enrollments (status);

CREATE INDEX IF NOT EXISTS idx_enrollments_youth_id
  ON public.enrollments (youth_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_year_status
  ON public.enrollments (year, status);

CREATE INDEX IF NOT EXISTS idx_enrollments_created_at
  ON public.enrollments (created_at DESC);


-- ----------------------------------------------------------------
-- youth_leadership_roles
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_leaders_level
  ON public.youth_leadership_roles (level);

CREATE INDEX IF NOT EXISTS idx_leaders_deanery_id
  ON public.youth_leadership_roles (deanery_id);

CREATE INDEX IF NOT EXISTS idx_leaders_parish_id
  ON public.youth_leadership_roles (parish_id);

CREATE INDEX IF NOT EXISTS idx_leaders_outstation_id
  ON public.youth_leadership_roles (outstation_id);

CREATE INDEX IF NOT EXISTS idx_leaders_youth_id
  ON public.youth_leadership_roles (youth_id);

-- Partial index: active-only leaders (end_date IS NULL) — used by KPI counts
CREATE INDEX IF NOT EXISTS idx_leaders_active
  ON public.youth_leadership_roles (level, start_date DESC)
  WHERE end_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_leaders_level_end_date
  ON public.youth_leadership_roles (level, end_date);

CREATE INDEX IF NOT EXISTS idx_leaders_start_date
  ON public.youth_leadership_roles (start_date DESC);


-- ----------------------------------------------------------------
-- events
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_events_event_date
  ON public.events (event_date DESC);

CREATE INDEX IF NOT EXISTS idx_events_deanery_id
  ON public.events (deanery_id);

CREATE INDEX IF NOT EXISTS idx_events_parish_id
  ON public.events (parish_id);

CREATE INDEX IF NOT EXISTS idx_events_name_trgm
  ON public.events USING gin (name gin_trgm_ops);


-- ----------------------------------------------------------------
-- welfare_cases
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_welfare_status
  ON public.welfare_cases (status);

CREATE INDEX IF NOT EXISTS idx_welfare_urgency
  ON public.welfare_cases (urgency);

CREATE INDEX IF NOT EXISTS idx_welfare_parish_id
  ON public.welfare_cases (parish_id);

-- Composite: most common combined filter (open + high urgency)
CREATE INDEX IF NOT EXISTS idx_welfare_status_urgency
  ON public.welfare_cases (status, urgency);

CREATE INDEX IF NOT EXISTS idx_welfare_opened_at
  ON public.welfare_cases (opened_at DESC);


-- ----------------------------------------------------------------
-- uniform_skus
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_uniform_skus_name
  ON public.uniform_skus (name);

CREATE INDEX IF NOT EXISTS idx_uniform_skus_name_trgm
  ON public.uniform_skus USING gin (name gin_trgm_ops);


-- ----------------------------------------------------------------
-- uniform_sales
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_uniform_sales_stage
  ON public.uniform_sales (stage);

CREATE INDEX IF NOT EXISTS idx_uniform_sales_payment_status
  ON public.uniform_sales (payment_status);

CREATE INDEX IF NOT EXISTS idx_uniform_sales_sku_id
  ON public.uniform_sales (sku_id);

CREATE INDEX IF NOT EXISTS idx_uniform_sales_ordered_at
  ON public.uniform_sales (ordered_at DESC);

CREATE INDEX IF NOT EXISTS idx_uniform_sales_stage_payment
  ON public.uniform_sales (stage, payment_status);
