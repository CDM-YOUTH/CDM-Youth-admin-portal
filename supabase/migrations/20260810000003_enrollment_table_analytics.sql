-- Enrollment tab analytics should read from enrollment rows, not youth rows.
-- This adds a year trend and a year-scoped demographic snapshot sourced from
-- the enrollments table, with youth joins only for scope and gender.

CREATE OR REPLACE FUNCTION public.get_enrollment_trend(
  p_year          int  DEFAULT EXTRACT(YEAR FROM now())::int,
  p_years_back    int  DEFAULT 5,
  p_deanery_id    uuid DEFAULT NULL,
  p_parish_id     uuid DEFAULT NULL,
  p_outstation_id uuid DEFAULT NULL
)
RETURNS TABLE (
  year     int,
  enrolled bigint,
  paid     bigint,
  pending  bigint,
  waived   bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH years AS (
    SELECT generate_series(p_year - p_years_back, p_year) AS year
  ),
  scoped AS (
    SELECT DISTINCT ON (e.youth_id, e.year)
      e.youth_id,
      e.year,
      e.status
    FROM enrollments e
    JOIN youths y ON y.id = e.youth_id
    WHERE e.year BETWEEN (p_year - p_years_back) AND p_year
      AND (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
      AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
      AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    ORDER BY e.youth_id, e.year, e.created_at DESC, e.id DESC
  )
  SELECT
    ys.year::int,
    COUNT(s.youth_id)::bigint AS enrolled,
    COUNT(s.youth_id) FILTER (WHERE s.status = 'paid')::bigint AS paid,
    COUNT(s.youth_id) FILTER (WHERE s.status = 'pending')::bigint AS pending,
    COUNT(s.youth_id) FILTER (WHERE s.status = 'waived')::bigint AS waived
  FROM years ys
  LEFT JOIN scoped s ON s.year = ys.year
  GROUP BY ys.year
  ORDER BY ys.year;
$$;

CREATE OR REPLACE FUNCTION public.get_enrollment_demographics(
  p_year          int  DEFAULT EXTRACT(YEAR FROM now())::int,
  p_deanery_id    uuid DEFAULT NULL,
  p_parish_id     uuid DEFAULT NULL,
  p_outstation_id uuid DEFAULT NULL
)
RETURNS TABLE (
  enrolled  bigint,
  paid      bigint,
  pending   bigint,
  waived    bigint,
  male      bigint,
  female    bigint,
  cat_primary   bigint,
  cat_secondary bigint,
  cat_tertiary  bigint,
  cat_working   bigint,
  cat_other     bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT DISTINCT ON (e.youth_id)
      e.youth_id,
      e.status,
      e.category,
      y.gender
    FROM enrollments e
    JOIN youths y ON y.id = e.youth_id
    WHERE e.year = p_year
      AND (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
      AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
      AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    ORDER BY e.youth_id, e.created_at DESC, e.id DESC
  )
  SELECT
    COUNT(*)::bigint AS enrolled,
    COUNT(*) FILTER (WHERE status = 'paid')::bigint AS paid,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint AS pending,
    COUNT(*) FILTER (WHERE status = 'waived')::bigint AS waived,
    COUNT(*) FILTER (WHERE gender = 'Male')::bigint AS male,
    COUNT(*) FILTER (WHERE gender = 'Female')::bigint AS female,
    COUNT(*) FILTER (WHERE category = 'Primary')::bigint AS cat_primary,
    COUNT(*) FILTER (WHERE category = 'Secondary')::bigint AS cat_secondary,
    COUNT(*) FILTER (WHERE category = 'Tertiary')::bigint AS cat_tertiary,
    COUNT(*) FILTER (WHERE category = 'Working')::bigint AS cat_working,
    COUNT(*) FILTER (WHERE COALESCE(category::text, 'Other') = 'Other')::bigint AS cat_other
  FROM scoped;
$$;

GRANT EXECUTE ON FUNCTION public.get_enrollment_trend(int, int, uuid, uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_enrollment_demographics(int, uuid, uuid, uuid) TO authenticated, anon;
