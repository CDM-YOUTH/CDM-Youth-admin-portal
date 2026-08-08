-- Redesign get_leader_breakdown to mirror the enrollment analytics pattern.
-- Groups by deanery/parish/outstation (controlled by p_group_by) and returns
-- per-level active leader counts so the UI can build the cross-tab table.
-- COUNT(DISTINCT youth_id) prevents double-counting leaders with multiple roles.
CREATE OR REPLACE FUNCTION public.get_leader_breakdown(
  p_deanery_id    uuid DEFAULT NULL,
  p_parish_id     uuid DEFAULT NULL,
  p_outstation_id uuid DEFAULT NULL,
  p_group_by      text DEFAULT 'deanery'   -- 'deanery' | 'parish' | 'outstation'
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
  -- Compute "effective" org keys for each active role so we can group by
  -- deanery/parish/outstation regardless of the role's own level.
  WITH roles AS (
    SELECT
      lr.youth_id,
      lr.level,
      -- Effective deanery: diocese/deanery roles carry deanery_id directly;
      -- parish roles resolve via parish.deanery_id; outstation via chain.
      COALESCE(lr.deanery_id, p.deanery_id,  op.deanery_id)  AS eff_deanery_id,
      COALESCE(d.name,        pd.name,        od.name)         AS eff_deanery_name,
      -- Effective parish: parish roles use parish_id; outstation via parent parish.
      COALESCE(lr.parish_id,  o.parish_id)                     AS eff_parish_id,
      COALESCE(p.name,        op.name)                         AS eff_parish_name,
      -- Effective outstation: only outstation-level roles have one.
      lr.outstation_id                                          AS eff_outstation_id,
      o.name                                                    AS eff_outstation_name
    FROM youth_leadership_roles lr
    LEFT JOIN deaneries   d   ON d.id   = lr.deanery_id
    LEFT JOIN parishes    p   ON p.id   = lr.parish_id
    LEFT JOIN deaneries   pd  ON pd.id  = p.deanery_id
    LEFT JOIN outstations o   ON o.id   = lr.outstation_id
    LEFT JOIN parishes    op  ON op.id  = o.parish_id
    LEFT JOIN deaneries   od  ON od.id  = op.deanery_id
    WHERE lr.end_date IS NULL
      AND (p_deanery_id IS NULL
           OR lr.deanery_id = p_deanery_id
           OR p.deanery_id  = p_deanery_id
           OR op.deanery_id = p_deanery_id)
      AND (p_parish_id IS NULL
           OR lr.parish_id = p_parish_id
           OR o.parish_id  = p_parish_id)
      AND (p_outstation_id IS NULL
           OR lr.outstation_id = p_outstation_id)
  ),
  -- Compute the grouping key per row before aggregating.
  keyed AS (
    SELECT
      CASE p_group_by
        WHEN 'outstation' THEN eff_outstation_id
        WHEN 'parish'     THEN eff_parish_id
        ELSE                   eff_deanery_id
      END AS grp_id,
      COALESCE(
        CASE p_group_by
          WHEN 'outstation' THEN eff_outstation_name
          WHEN 'parish'     THEN eff_parish_name
          ELSE                   eff_deanery_name
        END,
        'Diocese-wide'
      ) AS grp_label,
      eff_deanery_id,
      eff_deanery_name,
      eff_parish_id,
      eff_parish_name,
      level,
      youth_id
    FROM roles
  )
  SELECT
    grp_id                                                                           AS id,
    MAX(grp_label)                                                                   AS label,
    MAX(eff_deanery_id::text)::uuid                                                  AS deanery_id,
    MAX(eff_deanery_name)                                                            AS deanery_name,
    MAX(eff_parish_id::text)::uuid                                                   AS parish_id,
    MAX(eff_parish_name)                                                             AS parish_name,
    COUNT(DISTINCT CASE WHEN level = 'diocese'    THEN youth_id END)::bigint         AS diocese_active,
    COUNT(DISTINCT CASE WHEN level = 'deanery'    THEN youth_id END)::bigint         AS deanery_active,
    COUNT(DISTINCT CASE WHEN level = 'parish'     THEN youth_id END)::bigint         AS parish_active,
    COUNT(DISTINCT CASE WHEN level = 'outstation' THEN youth_id END)::bigint         AS outstation_active,
    COUNT(DISTINCT youth_id)::bigint                                                 AS total_active
  FROM keyed
  GROUP BY grp_id
  ORDER BY total_active DESC NULLS LAST, MAX(grp_label) ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_leader_breakdown TO authenticated, anon;
