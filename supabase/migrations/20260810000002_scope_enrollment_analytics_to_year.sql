-- Scope enrollment analytics to the requested year and dedupe by youth.
-- This mirrors the org-universe pattern used for leader analytics so the
-- dashboard returns one row per deanery/parish/outstation unit.

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
    JOIN parishes p   ON p.id  = o.parish_id
    JOIN deaneries pd ON pd.id = p.deanery_id
    WHERE p_group_by = 'outstation'
      AND (p_deanery_id    IS NULL OR pd.id = p_deanery_id)
      AND (p_parish_id     IS NULL OR p.id  = p_parish_id)
      AND (p_outstation_id IS NULL OR o.id  = p_outstation_id)
  ),
  youths_in_scope AS (
    SELECT DISTINCT
      y.id,
      y.deanery_id,
      y.parish_id,
      y.outstation_id
    FROM youths y
    WHERE
      (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
      AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
      AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
  ),
  enroll_rows AS (
    SELECT DISTINCT ON (e.youth_id)
      e.youth_id,
      e.status,
      y.deanery_id,
      y.parish_id,
      y.outstation_id,
      d.id   AS org_deanery_id,
      d.name AS org_deanery_name,
      p.id   AS org_parish_id,
      p.name AS org_parish_name,
      o.id   AS org_outstation_id
    FROM enrollments e
    JOIN youths y ON y.id = e.youth_id
    LEFT JOIN deaneries   d ON d.id = y.deanery_id
    LEFT JOIN parishes    p ON p.id = y.parish_id
    LEFT JOIN outstations o ON o.id = y.outstation_id
    WHERE e.year = p_year
      AND (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
      AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
      AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    ORDER BY e.youth_id, e.created_at DESC, e.id DESC
  )
  SELECT
    u.grp_id,
    u.grp_label,
    u.eff_deanery_id,
    u.eff_deanery_name,
    u.eff_parish_id,
    u.eff_parish_name,
    (SELECT COUNT(*) FROM youths_in_scope ys
     WHERE (p_group_by = 'deanery'    AND ys.deanery_id    = u.grp_id)
        OR (p_group_by = 'parish'     AND ys.parish_id     = u.grp_id)
        OR (p_group_by = 'outstation' AND ys.outstation_id = u.grp_id)
    )::bigint AS total_youths,
    (SELECT COUNT(*) FROM enroll_rows r
     WHERE (p_group_by = 'deanery'    AND r.deanery_id    = u.grp_id)
        OR (p_group_by = 'parish'     AND r.parish_id     = u.grp_id)
        OR (p_group_by = 'outstation' AND r.outstation_id = u.grp_id)
    )::bigint AS enrolled,
    (SELECT COUNT(*) FROM enroll_rows r
     WHERE r.status = 'paid'
       AND (
         (p_group_by = 'deanery'    AND r.deanery_id    = u.grp_id) OR
         (p_group_by = 'parish'     AND r.parish_id     = u.grp_id) OR
         (p_group_by = 'outstation' AND r.outstation_id = u.grp_id)
       )
    )::bigint AS paid,
    (SELECT COUNT(*) FROM enroll_rows r
     WHERE r.status = 'pending'
       AND (
         (p_group_by = 'deanery'    AND r.deanery_id    = u.grp_id) OR
         (p_group_by = 'parish'     AND r.parish_id     = u.grp_id) OR
         (p_group_by = 'outstation' AND r.outstation_id = u.grp_id)
       )
    )::bigint AS pending,
    (SELECT COUNT(*) FROM enroll_rows r
     WHERE r.status = 'waived'
       AND (
         (p_group_by = 'deanery'    AND r.deanery_id    = u.grp_id) OR
         (p_group_by = 'parish'     AND r.parish_id     = u.grp_id) OR
         (p_group_by = 'outstation' AND r.outstation_id = u.grp_id)
       )
    )::bigint AS waived
  FROM universe u
  ORDER BY enrolled DESC NULLS LAST, 2 ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_summary TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_enrollment_breakdown(int, uuid, uuid, uuid, text) TO authenticated, anon;
