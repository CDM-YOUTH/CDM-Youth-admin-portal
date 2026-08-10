-- Fix diocese-level leader aggregation.
-- Diocesan leaders are global, so they need their own bucket in the breakdown
-- and they must be included in the active-leaders KPI regardless of scope.

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
    (SELECT COUNT(*) FROM youths y
     WHERE (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
       AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
       AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    )::bigint AS total_youths,

    (SELECT COUNT(*) FROM youths y
     WHERE y.status = 'active'
       AND (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
       AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
       AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    )::bigint AS active_youths,

    (SELECT COUNT(DISTINCT e.youth_id) FROM enrollments e
     JOIN youths y ON y.id = e.youth_id
     WHERE e.year = p_year
       AND (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
       AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
       AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    )::bigint AS enrolled,

    (SELECT COUNT(DISTINCT e.youth_id) FROM enrollments e
     JOIN youths y ON y.id = e.youth_id
     WHERE e.year = p_year AND e.status = 'pending'
       AND (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
       AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
       AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    )::bigint AS pending_enrollments,

    (SELECT COUNT(DISTINCT cm.youth_id) FROM cusa_members cm
     JOIN youths y ON y.id = cm.youth_id
     WHERE cm.year = p_year
       AND (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
       AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
       AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    )::bigint AS cusa_members,

    (SELECT COUNT(DISTINCT cm.youth_id) FROM cusa_members cm
     JOIN youths y ON y.id = cm.youth_id
     WHERE cm.year = p_year
       AND cm.leadership_role IS NOT NULL
       AND (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
       AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
       AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    )::bigint AS cusa_active,

    (SELECT COUNT(DISTINCT lr.youth_id) FROM youth_leadership_roles lr
     JOIN youths y ON y.id = lr.youth_id
     WHERE lr.end_date IS NULL
       AND (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
       AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
       AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    )::bigint AS active_leaders,

    (SELECT COUNT(*) FROM events e
     WHERE e.event_date >= CURRENT_DATE
       AND (p_deanery_id IS NULL OR e.deanery_id = p_deanery_id OR e.deanery_id IS NULL)
       AND (p_parish_id  IS NULL OR e.parish_id  = p_parish_id  OR e.parish_id  IS NULL)
    )::bigint AS upcoming_events,

    (SELECT COUNT(*) FROM welfare_cases wc
     WHERE wc.status IN ('open', 'in_progress')
       AND (p_parish_id IS NULL OR wc.parish_id = p_parish_id)
    )::bigint AS welfare_open,

    (SELECT COUNT(*) FROM welfare_cases wc
     WHERE wc.status IN ('open', 'in_progress') AND wc.urgency = 'high'
       AND (p_parish_id IS NULL OR wc.parish_id = p_parish_id)
    )::bigint AS welfare_urgent;
$$;

DROP FUNCTION IF EXISTS public.get_leader_breakdown(uuid, uuid, uuid, text);

CREATE FUNCTION public.get_leader_breakdown(
  p_deanery_id    uuid DEFAULT NULL,
  p_parish_id     uuid DEFAULT NULL,
  p_outstation_id uuid DEFAULT NULL,
  p_group_by      text DEFAULT 'deanery'
)
RETURNS TABLE (
  id                uuid,
  label             text,
  deanery_id        uuid,
  deanery_name      text,
  parish_id         uuid,
  parish_name       text,
  diocese_active    bigint,
  deanery_active    bigint,
  parish_active     bigint,
  outstation_active bigint,
  total_active      bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  universe AS (
    SELECT d.id       AS grp_id,
           d.name     AS grp_label,
           d.id       AS eff_deanery_id,
           d.name     AS eff_deanery_name,
           NULL::uuid AS eff_parish_id,
           NULL::text AS eff_parish_name,
           1          AS sort_order
    FROM deaneries d
    WHERE p_group_by = 'deanery'
      AND (p_deanery_id IS NULL OR d.id = p_deanery_id)

    UNION ALL

    SELECT p.id, p.name, d.id, d.name, p.id, p.name, 2
    FROM parishes p
    JOIN deaneries d ON d.id = p.deanery_id
    WHERE p_group_by = 'parish'
      AND (p_deanery_id IS NULL OR p.deanery_id = p_deanery_id)
      AND (p_parish_id  IS NULL OR p.id         = p_parish_id)

    UNION ALL

    SELECT o.id, o.name, pd.id, pd.name, p.id, p.name, 3
    FROM outstations o
    JOIN parishes  p  ON p.id  = o.parish_id
    JOIN deaneries pd ON pd.id = p.deanery_id
    WHERE p_group_by = 'outstation'
      AND (p_deanery_id    IS NULL OR pd.id = p_deanery_id)
      AND (p_parish_id     IS NULL OR p.id  = p_parish_id)
      AND (p_outstation_id IS NULL OR o.id  = p_outstation_id)

  ),

  roles AS (
    SELECT
      lr.youth_id,
      lr.level,
      CASE
        WHEN lr.level = 'diocese' THEN y.deanery_id
        ELSE COALESCE(lr.deanery_id, p.deanery_id, op.deanery_id)
      END AS eff_deanery_id,
      CASE
        WHEN lr.level = 'diocese' THEN y.parish_id
        ELSE COALESCE(lr.parish_id, o.parish_id)
      END AS eff_parish_id,
      CASE
        WHEN lr.level = 'diocese' THEN y.outstation_id
        ELSE lr.outstation_id
      END AS eff_outstation_id
    FROM youth_leadership_roles lr
    JOIN youths y ON y.id = lr.youth_id
    LEFT JOIN parishes    p  ON p.id  = lr.parish_id
    LEFT JOIN outstations o  ON o.id  = lr.outstation_id
    LEFT JOIN parishes    op ON op.id = o.parish_id
    WHERE lr.end_date IS NULL
  )

  SELECT
    u.grp_id,
    u.grp_label,
    u.eff_deanery_id,
    u.eff_deanery_name,
    u.eff_parish_id,
    u.eff_parish_name,
    COUNT(DISTINCT CASE WHEN r.level = 'diocese'    THEN r.youth_id END)::bigint,
    COUNT(DISTINCT CASE WHEN r.level = 'deanery'    THEN r.youth_id END)::bigint,
    COUNT(DISTINCT CASE WHEN r.level = 'parish'     THEN r.youth_id END)::bigint,
    COUNT(DISTINCT CASE WHEN r.level = 'outstation' THEN r.youth_id END)::bigint,
    COUNT(DISTINCT r.youth_id)::bigint
  FROM universe u
  LEFT JOIN roles r ON (
    (p_group_by = 'deanery'    AND u.grp_id IS NOT NULL AND r.eff_deanery_id    = u.grp_id)
    OR (p_group_by = 'parish'     AND u.grp_id IS NOT NULL AND r.eff_parish_id     = u.grp_id)
    OR (p_group_by = 'outstation' AND u.grp_id IS NOT NULL AND r.eff_outstation_id = u.grp_id)
  )
  GROUP BY u.grp_id, u.grp_label, u.eff_deanery_id, u.eff_deanery_name,
           u.eff_parish_id, u.eff_parish_name, u.sort_order
  ORDER BY u.sort_order, 11 DESC NULLS LAST, 2 ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_summary TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_leader_breakdown(uuid, uuid, uuid, text) TO authenticated, anon;
