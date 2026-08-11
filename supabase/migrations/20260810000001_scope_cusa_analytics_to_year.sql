-- Scope CUSA analytics to a specific year and dedupe by youth.
-- This keeps the dashboard output to one row per org unit while avoiding
-- inflation from historical CUSA rows.

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

    (SELECT COUNT(*) FROM enrollments e
     JOIN youths y ON y.id = e.youth_id
     WHERE e.year = p_year
       AND (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
       AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
       AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    )::bigint AS enrolled,

    (SELECT COUNT(*) FROM enrollments e
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

CREATE OR REPLACE FUNCTION public.get_cusa_breakdown(
  p_year          int  DEFAULT EXTRACT(YEAR FROM now())::int,
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
  WITH universe AS (
    SELECT d.id AS grp_id, d.name AS grp_label, d.id AS eff_deanery_id, d.name AS eff_deanery_name,
           NULL::uuid AS eff_parish_id, NULL::text AS eff_parish_name
    FROM deaneries d
    WHERE p_group_by = 'deanery'
      AND (p_deanery_id IS NULL OR d.id = p_deanery_id)

    UNION ALL

    SELECT p.id, p.name, d.id, d.name, p.id, p.name
    FROM parishes p
    JOIN deaneries d ON d.id = p.deanery_id
    WHERE p_group_by = 'parish'
      AND (p_deanery_id IS NULL OR p.deanery_id = p_deanery_id)
      AND (p_parish_id  IS NULL OR p.id = p_parish_id)

    UNION ALL

    SELECT o.id, o.name, pd.id, pd.name, p.id, p.name
    FROM outstations o
    JOIN parishes p  ON p.id  = o.parish_id
    JOIN deaneries pd ON pd.id = p.deanery_id
    WHERE p_group_by = 'outstation'
      AND (p_deanery_id    IS NULL OR pd.id = p_deanery_id)
      AND (p_parish_id     IS NULL OR p.id  = p_parish_id)
      AND (p_outstation_id IS NULL OR o.id  = p_outstation_id)
  ),
  members AS (
    SELECT DISTINCT ON (cm.youth_id)
      cm.youth_id,
      cm.leadership_role,
      y.gender,
      y.deanery_id,
      y.parish_id,
      y.outstation_id,
      d.id   AS org_deanery_id,
      d.name AS org_deanery_name,
      p.id   AS org_parish_id,
      p.name AS org_parish_name,
      o.id   AS org_outstation_id
    FROM cusa_members cm
    JOIN youths y ON y.id = cm.youth_id
    LEFT JOIN deaneries   d ON d.id = y.deanery_id
    LEFT JOIN parishes    p ON p.id = y.parish_id
    LEFT JOIN outstations o ON o.id = y.outstation_id
    WHERE cm.year = p_year
      AND (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
      AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
      AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
      AND (p_institution   IS NULL OR cm.institution   = p_institution)
    ORDER BY cm.youth_id, cm.created_at DESC, cm.id DESC
  )
  SELECT
    u.grp_id,
    u.grp_label,
    u.eff_deanery_id,
    u.eff_deanery_name,
    u.eff_parish_id,
    u.eff_parish_name,
    COUNT(DISTINCT m.youth_id)::bigint AS total,
    COUNT(DISTINCT m.youth_id) FILTER (WHERE m.leadership_role IS NOT NULL)::bigint AS with_role,
    COUNT(DISTINCT m.youth_id) FILTER (WHERE m.gender = 'Male')::bigint AS male,
    COUNT(DISTINCT m.youth_id) FILTER (WHERE m.gender = 'Female')::bigint AS female
  FROM universe u
  LEFT JOIN members m ON (
    (p_group_by = 'deanery'    AND m.deanery_id    = u.grp_id) OR
    (p_group_by = 'parish'     AND m.parish_id     = u.grp_id) OR
    (p_group_by = 'outstation' AND m.outstation_id = u.grp_id)
  )
  GROUP BY u.grp_id, u.grp_label, u.eff_deanery_id, u.eff_deanery_name,
           u.eff_parish_id, u.eff_parish_name
  ORDER BY total DESC NULLS LAST, 2 ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_summary TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_cusa_breakdown(int, uuid, uuid, uuid, text, text) TO authenticated, anon;
