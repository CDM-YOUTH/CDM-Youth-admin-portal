-- Redesign get_leader_breakdown to mirror the enrollment analytics pattern.
-- Starts from the org-unit tables (deaneries/parishes/outstations) so every
-- unit appears even with zero leaders, and diocese-wide roles are excluded
-- from the deanery view (no spurious "Diocese-wide" row).
DROP FUNCTION IF EXISTS public.get_leader_breakdown(uuid, uuid, uuid);
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
           NULL::text AS eff_parish_name
    FROM deaneries d
    WHERE p_group_by = 'deanery'
      AND (p_deanery_id IS NULL OR d.id = p_deanery_id)

    UNION ALL

    SELECT p.id, p.name, d.id, d.name, p.id, p.name
    FROM parishes p
    JOIN deaneries d ON d.id = p.deanery_id
    WHERE p_group_by = 'parish'
      AND (p_deanery_id IS NULL OR p.deanery_id = p_deanery_id)
      AND (p_parish_id  IS NULL OR p.id         = p_parish_id)

    UNION ALL

    SELECT o.id, o.name, pd.id, pd.name, p.id, p.name
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
      COALESCE(lr.deanery_id, p.deanery_id,  op.deanery_id) AS eff_deanery_id,
      COALESCE(lr.parish_id,  o.parish_id)                   AS eff_parish_id,
      lr.outstation_id                                        AS eff_outstation_id
    FROM youth_leadership_roles lr
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
    (p_group_by = 'deanery'    AND r.eff_deanery_id    = u.grp_id) OR
    (p_group_by = 'parish'     AND r.eff_parish_id     = u.grp_id) OR
    (p_group_by = 'outstation' AND r.eff_outstation_id = u.grp_id)
  )
  GROUP BY u.grp_id, u.grp_label, u.eff_deanery_id, u.eff_deanery_name,
           u.eff_parish_id, u.eff_parish_name
  ORDER BY 11 DESC NULLS LAST, 2 ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_leader_breakdown TO authenticated, anon;
