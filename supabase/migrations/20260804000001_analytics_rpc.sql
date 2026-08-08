-- ================================================================
-- Analytics RPC Functions
--
-- All functions use typed UUID / int parameters passed as bind
-- variables — SQL injection is structurally impossible.
-- NULL parameter means "no restriction at that level" (diocese-wide).
-- SECURITY DEFINER + SET search_path = public prevents search-path
-- hijacking by unprivileged callers.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. get_analytics_summary
--    Single-row KPI snapshot scoped to the given org unit.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_analytics_summary(
  p_year          int  DEFAULT EXTRACT(YEAR FROM now())::int,
  p_deanery_id    uuid DEFAULT NULL,
  p_parish_id     uuid DEFAULT NULL,
  p_outstation_id uuid DEFAULT NULL
)
RETURNS TABLE (
  total_youths        bigint,
  active_youths       bigint,
  enrolled            bigint,
  pending_enrollments bigint,
  cusa_members        bigint,
  cusa_active         bigint,
  active_leaders      bigint,
  upcoming_events     bigint,
  welfare_open        bigint,
  welfare_urgent      bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Total registered youths
    (SELECT COUNT(*) FROM youths y
     WHERE (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
       AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
       AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    )::bigint AS total_youths,

    -- Active youths
    (SELECT COUNT(*) FROM youths y
     WHERE y.status = 'active'
       AND (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
       AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
       AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    )::bigint AS active_youths,

    -- Enrolled for the year
    (SELECT COUNT(*) FROM enrollments e
     JOIN youths y ON y.id = e.youth_id
     WHERE e.year = p_year
       AND (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
       AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
       AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    )::bigint AS enrolled,

    -- Pending payment this year
    (SELECT COUNT(*) FROM enrollments e
     JOIN youths y ON y.id = e.youth_id
     WHERE e.year = p_year AND e.status = 'pending'
       AND (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
       AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
       AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    )::bigint AS pending_enrollments,

    -- CUSA members
    (SELECT COUNT(*) FROM cusa_members cm
     JOIN youths y ON y.id = cm.youth_id
     WHERE (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
       AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
       AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    )::bigint AS cusa_members,

    -- CUSA members with a leadership role
    (SELECT COUNT(*) FROM cusa_members cm
     JOIN youths y ON y.id = cm.youth_id
     WHERE cm.leadership_role IS NOT NULL
       AND (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
       AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
       AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    )::bigint AS cusa_active,

    -- Distinct individuals with at least one active leadership role in scope
    (SELECT COUNT(DISTINCT lr.youth_id) FROM youth_leadership_roles lr
     LEFT JOIN parishes    p  ON p.id  = lr.parish_id
     LEFT JOIN outstations o  ON o.id  = lr.outstation_id
     LEFT JOIN parishes    p2 ON p2.id = o.parish_id
     WHERE lr.end_date IS NULL
       AND (p_deanery_id IS NULL
            OR lr.deanery_id = p_deanery_id
            OR p.deanery_id  = p_deanery_id
            OR p2.deanery_id = p_deanery_id)
       AND (p_parish_id IS NULL
            OR lr.parish_id = p_parish_id
            OR o.parish_id  = p_parish_id)
       AND (p_outstation_id IS NULL
            OR lr.outstation_id = p_outstation_id)
    )::bigint AS active_leaders,

    -- Upcoming events (include diocese-wide events for any scope)
    (SELECT COUNT(*) FROM events e
     WHERE e.event_date >= CURRENT_DATE
       AND (p_deanery_id IS NULL OR e.deanery_id = p_deanery_id OR e.deanery_id IS NULL)
       AND (p_parish_id  IS NULL OR e.parish_id  = p_parish_id  OR e.parish_id  IS NULL)
    )::bigint AS upcoming_events,

    -- Open welfare cases (welfare scoped by parish only)
    (SELECT COUNT(*) FROM welfare_cases wc
     WHERE wc.status IN ('open', 'in_progress')
       AND (p_parish_id IS NULL OR wc.parish_id = p_parish_id)
    )::bigint AS welfare_open,

    -- Urgent open welfare cases
    (SELECT COUNT(*) FROM welfare_cases wc
     WHERE wc.status IN ('open', 'in_progress') AND wc.urgency = 'high'
       AND (p_parish_id IS NULL OR wc.parish_id = p_parish_id)
    )::bigint AS welfare_urgent;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_summary TO authenticated, anon;


-- ----------------------------------------------------------------
-- 2. get_youth_breakdown
--    Youth counts grouped by deanery, parish, or outstation.
--    Returns one row per org unit with gender + category splits.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_youth_breakdown(
  p_deanery_id    uuid DEFAULT NULL,
  p_parish_id     uuid DEFAULT NULL,
  p_outstation_id uuid DEFAULT NULL,
  p_group_by      text DEFAULT 'deanery'  -- 'deanery' | 'parish' | 'outstation'
)
RETURNS TABLE (
  id             uuid,
  label          text,
  deanery_id     uuid,
  deanery_name   text,
  parish_id      uuid,
  parish_name    text,
  total          bigint,
  active         bigint,
  male           bigint,
  female         bigint,
  cat_primary    bigint,
  cat_secondary  bigint,
  cat_tertiary   bigint,
  cat_working    bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE p_group_by
      WHEN 'outstation' THEN y.outstation_id
      WHEN 'parish'     THEN y.parish_id
      ELSE                   y.deanery_id
    END AS id,
    CASE p_group_by
      WHEN 'outstation' THEN o.name
      WHEN 'parish'     THEN p.name
      ELSE                   d.name
    END AS label,
    d.id   AS deanery_id,
    d.name AS deanery_name,
    p.id   AS parish_id,
    p.name AS parish_name,
    COUNT(*)::bigint                                            AS total,
    COUNT(*) FILTER (WHERE y.status   = 'active')::bigint      AS active,
    COUNT(*) FILTER (WHERE y.gender   = 'Male')::bigint        AS male,
    COUNT(*) FILTER (WHERE y.gender   = 'Female')::bigint      AS female,
    COUNT(*) FILTER (WHERE y.category = 'Primary')::bigint     AS cat_primary,
    COUNT(*) FILTER (WHERE y.category = 'Secondary')::bigint   AS cat_secondary,
    COUNT(*) FILTER (WHERE y.category = 'Tertiary')::bigint    AS cat_tertiary,
    COUNT(*) FILTER (WHERE y.category = 'Working')::bigint     AS cat_working
  FROM youths y
  LEFT JOIN deaneries   d ON d.id = y.deanery_id
  LEFT JOIN parishes    p ON p.id = y.parish_id
  LEFT JOIN outstations o ON o.id = y.outstation_id
  WHERE
    (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
    AND (p_parish_id    IS NULL OR y.parish_id    = p_parish_id)
    AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
  GROUP BY 1, 2, d.id, d.name, p.id, p.name
  ORDER BY total DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_youth_breakdown TO authenticated, anon;


-- ----------------------------------------------------------------
-- 3. get_enrollment_breakdown
--    Enrollment counts by org unit with status split.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_enrollment_breakdown(
  p_year          int  DEFAULT EXTRACT(YEAR FROM now())::int,
  p_deanery_id    uuid DEFAULT NULL,
  p_parish_id     uuid DEFAULT NULL,
  p_outstation_id uuid DEFAULT NULL,
  p_group_by      text DEFAULT 'deanery'
)
RETURNS TABLE (
  id           uuid,
  label        text,
  deanery_id   uuid,
  deanery_name text,
  parish_id    uuid,
  parish_name  text,
  total_youths bigint,
  enrolled     bigint,
  paid         bigint,
  pending      bigint,
  waived       bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE p_group_by
      WHEN 'outstation' THEN y.outstation_id
      WHEN 'parish'     THEN y.parish_id
      ELSE                   y.deanery_id
    END AS id,
    CASE p_group_by
      WHEN 'outstation' THEN o.name
      WHEN 'parish'     THEN p.name
      ELSE                   d.name
    END AS label,
    d.id   AS deanery_id,
    d.name AS deanery_name,
    p.id   AS parish_id,
    p.name AS parish_name,
    COUNT(DISTINCT y.id)::bigint                                         AS total_youths,
    COUNT(e.id)::bigint                                                  AS enrolled,
    COUNT(e.id) FILTER (WHERE e.status = 'paid')::bigint                 AS paid,
    COUNT(e.id) FILTER (WHERE e.status = 'pending')::bigint              AS pending,
    COUNT(e.id) FILTER (WHERE e.status = 'waived')::bigint               AS waived
  FROM youths y
  LEFT JOIN deaneries   d ON d.id = y.deanery_id
  LEFT JOIN parishes    p ON p.id = y.parish_id
  LEFT JOIN outstations o ON o.id = y.outstation_id
  LEFT JOIN enrollments e ON e.youth_id = y.id AND e.year = p_year
  WHERE
    (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
    AND (p_parish_id    IS NULL OR y.parish_id    = p_parish_id)
    AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
  GROUP BY 1, 2, d.id, d.name, p.id, p.name
  ORDER BY enrolled DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_enrollment_breakdown TO authenticated, anon;


-- ----------------------------------------------------------------
-- 4. get_cusa_breakdown
--    CUSA member counts by org unit, with institution and gender splits.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_cusa_breakdown(
  p_deanery_id    uuid DEFAULT NULL,
  p_parish_id     uuid DEFAULT NULL,
  p_outstation_id uuid DEFAULT NULL,
  p_group_by      text DEFAULT 'deanery',
  p_institution   text DEFAULT NULL
)
RETURNS TABLE (
  id            uuid,
  label         text,
  deanery_id    uuid,
  deanery_name  text,
  parish_id     uuid,
  parish_name   text,
  total         bigint,
  with_role     bigint,
  male          bigint,
  female        bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE p_group_by
      WHEN 'outstation' THEN y.outstation_id
      WHEN 'parish'     THEN y.parish_id
      ELSE                   y.deanery_id
    END AS id,
    CASE p_group_by
      WHEN 'outstation' THEN o.name
      WHEN 'parish'     THEN p.name
      ELSE                   d.name
    END AS label,
    d.id   AS deanery_id,
    d.name AS deanery_name,
    p.id   AS parish_id,
    p.name AS parish_name,
    COUNT(cm.id)::bigint                                               AS total,
    COUNT(cm.id) FILTER (WHERE cm.leadership_role IS NOT NULL)::bigint AS with_role,
    COUNT(cm.id) FILTER (WHERE y.gender = 'Male')::bigint             AS male,
    COUNT(cm.id) FILTER (WHERE y.gender = 'Female')::bigint           AS female
  FROM cusa_members cm
  JOIN youths y ON y.id = cm.youth_id
  LEFT JOIN deaneries   d ON d.id = y.deanery_id
  LEFT JOIN parishes    p ON p.id = y.parish_id
  LEFT JOIN outstations o ON o.id = y.outstation_id
  WHERE
    (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
    AND (p_parish_id    IS NULL OR y.parish_id    = p_parish_id)
    AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    AND (p_institution   IS NULL OR cm.institution   = p_institution)
  GROUP BY 1, 2, d.id, d.name, p.id, p.name
  ORDER BY total DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_cusa_breakdown TO authenticated, anon;


-- ----------------------------------------------------------------
-- 5. get_leader_breakdown
--    Active leader counts grouped by level, with the org-unit label.
--    Scope filtering traverses the org hierarchy so a deanery filter
--    includes parish and outstation leaders within that deanery.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_leader_breakdown(
  p_deanery_id    uuid DEFAULT NULL,
  p_parish_id     uuid DEFAULT NULL,
  p_outstation_id uuid DEFAULT NULL
)
RETURNS TABLE (
  level      text,
  org_label  text,
  active     bigint,
  total      bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lr.level,
    COALESCE(d.name, p.name, o.name, 'Diocese-wide') AS org_label,
    COUNT(*) FILTER (WHERE lr.end_date IS NULL)::bigint AS active,
    COUNT(*)::bigint                                    AS total
  FROM youth_leadership_roles lr
  LEFT JOIN deaneries   d  ON d.id  = lr.deanery_id
  LEFT JOIN parishes    p  ON p.id  = lr.parish_id
  LEFT JOIN outstations o  ON o.id  = lr.outstation_id
  LEFT JOIN parishes    p2 ON p2.id = o.parish_id
  WHERE
    -- Deanery scope: include roles at deanery level, parishes within, outstations within
    (p_deanery_id IS NULL
     OR lr.deanery_id = p_deanery_id
     OR p.deanery_id  = p_deanery_id
     OR p2.deanery_id = p_deanery_id)
    -- Parish scope: roles at that parish and its outstations
    AND (p_parish_id IS NULL
         OR lr.parish_id = p_parish_id
         OR o.parish_id  = p_parish_id)
    -- Outstation scope: direct match only
    AND (p_outstation_id IS NULL
         OR lr.outstation_id = p_outstation_id)
  GROUP BY lr.level, org_label
  ORDER BY
    CASE lr.level
      WHEN 'diocese'    THEN 1
      WHEN 'deanery'    THEN 2
      WHEN 'parish'     THEN 3
      WHEN 'outstation' THEN 4
    END,
    active DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_leader_breakdown TO authenticated, anon;


-- ----------------------------------------------------------------
-- 6. get_welfare_breakdown
--    Welfare case counts by status and urgency, grouped by parish.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_welfare_breakdown(
  p_parish_id uuid DEFAULT NULL
)
RETURNS TABLE (
  parish_id   uuid,
  parish_name text,
  open        bigint,
  in_progress bigint,
  resolved    bigint,
  closed      bigint,
  urgent      bigint,
  total       bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wc.parish_id,
    COALESCE(p.name, 'Unknown') AS parish_name,
    COUNT(*) FILTER (WHERE wc.status = 'open')::bigint        AS open,
    COUNT(*) FILTER (WHERE wc.status = 'in_progress')::bigint AS in_progress,
    COUNT(*) FILTER (WHERE wc.status = 'resolved')::bigint    AS resolved,
    COUNT(*) FILTER (WHERE wc.status = 'closed')::bigint      AS closed,
    COUNT(*) FILTER (WHERE wc.urgency = 'high'
                       AND wc.status IN ('open','in_progress'))::bigint AS urgent,
    COUNT(*)::bigint                                           AS total
  FROM welfare_cases wc
  LEFT JOIN parishes p ON p.id = wc.parish_id
  WHERE (p_parish_id IS NULL OR wc.parish_id = p_parish_id)
  GROUP BY wc.parish_id, p.name
  ORDER BY open DESC, total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_welfare_breakdown TO authenticated, anon;


-- ----------------------------------------------------------------
-- 7. get_event_breakdown
--    Event counts by org unit with attendance totals.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_event_breakdown(
  p_deanery_id uuid DEFAULT NULL,
  p_parish_id  uuid DEFAULT NULL,
  p_from_date  date DEFAULT NULL,
  p_to_date    date DEFAULT NULL
)
RETURNS TABLE (
  org_id       uuid,
  org_label    text,
  level        text,
  total_events bigint,
  upcoming     bigint,
  completed    bigint,
  total_checkins bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(e.parish_id, e.deanery_id)              AS org_id,
    COALESCE(p.name, d.name, 'Diocese-wide')          AS org_label,
    CASE
      WHEN e.parish_id  IS NOT NULL THEN 'parish'
      WHEN e.deanery_id IS NOT NULL THEN 'deanery'
      ELSE 'diocese'
    END                                               AS level,
    COUNT(DISTINCT e.id)::bigint                      AS total_events,
    COUNT(DISTINCT e.id) FILTER (WHERE e.event_date >= CURRENT_DATE)::bigint  AS upcoming,
    COUNT(DISTINCT e.id) FILTER (WHERE e.event_date < CURRENT_DATE)::bigint   AS completed,
    COUNT(ec.id)::bigint                              AS total_checkins
  FROM events e
  LEFT JOIN parishes    p  ON p.id  = e.parish_id
  LEFT JOIN deaneries   d  ON d.id  = e.deanery_id
  LEFT JOIN event_checkins ec ON ec.event_id = e.id
  WHERE
    (p_deanery_id IS NULL OR e.deanery_id = p_deanery_id OR e.deanery_id IS NULL)
    AND (p_parish_id  IS NULL OR e.parish_id  = p_parish_id  OR e.parish_id  IS NULL)
    AND (p_from_date  IS NULL OR e.event_date >= p_from_date)
    AND (p_to_date    IS NULL OR e.event_date <= p_to_date)
  GROUP BY COALESCE(e.parish_id, e.deanery_id), org_label, level
  ORDER BY total_events DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_breakdown TO authenticated, anon;
