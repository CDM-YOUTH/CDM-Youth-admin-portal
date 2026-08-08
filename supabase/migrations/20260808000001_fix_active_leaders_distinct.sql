-- Fix: count distinct leader individuals instead of total role entries.
-- A youth holding roles at multiple levels was previously counted once per role.
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

    (SELECT COUNT(*) FROM cusa_members cm
     JOIN youths y ON y.id = cm.youth_id
     WHERE (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
       AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
       AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    )::bigint AS cusa_members,

    (SELECT COUNT(*) FROM cusa_members cm
     JOIN youths y ON y.id = cm.youth_id
     WHERE cm.leadership_role IS NOT NULL
       AND (p_deanery_id    IS NULL OR y.deanery_id    = p_deanery_id)
       AND (p_parish_id     IS NULL OR y.parish_id     = p_parish_id)
       AND (p_outstation_id IS NULL OR y.outstation_id = p_outstation_id)
    )::bigint AS cusa_active,

    -- Distinct individuals with at least one active role in scope
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

GRANT EXECUTE ON FUNCTION public.get_analytics_summary TO authenticated, anon;
