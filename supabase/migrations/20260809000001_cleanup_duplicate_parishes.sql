-- Remove short-name duplicate parishes that shadow saint-named versions.
-- Pattern: a parish whose name matches the location suffix of another parish
-- in the same deanery (e.g. "Makomboki" vs "St. Peter the Apostle, Makomboki").
-- All foreign-key references are migrated to the saint-named version first.

DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN
    SELECT
      short_p.id   AS dup_id,
      short_p.name AS dup_name,
      full_p.id    AS keep_id,
      full_p.name  AS keep_name,
      d.name       AS deanery_name
    FROM parishes short_p
    JOIN parishes full_p
      ON full_p.deanery_id = short_p.deanery_id
     AND full_p.id         <> short_p.id
     AND full_p.name ILIKE '%, ' || short_p.name
    JOIN deaneries d ON d.id = short_p.deanery_id
    -- Only target plain location names (no saint prefix)
    WHERE short_p.name NOT ILIKE 'St.%'
      AND short_p.name NOT ILIKE 'Saint%'
      AND short_p.name NOT ILIKE 'Our Lady%'
      AND short_p.name NOT ILIKE 'Sacred%'
      AND short_p.name NOT ILIKE 'Holy%'
      AND short_p.name NOT ILIKE 'Christ%'
      AND short_p.name NOT ILIKE 'Queen%'
      AND short_p.name NOT ILIKE 'Divine%'
      AND short_p.name NOT ILIKE 'Blessed%'
      AND short_p.name NOT ILIKE 'Mary%'
      AND short_p.name NOT ILIKE 'Ascension%'
      AND short_p.name NOT ILIKE 'Presentation%'
      AND short_p.name NOT ILIKE 'Annunciation%'
      AND short_p.name NOT ILIKE 'Transfiguration%'
      AND short_p.name NOT ILIKE 'Epiphany%'
      AND short_p.name NOT ILIKE 'Baptism%'
      AND short_p.name NOT ILIKE 'Guardian%'
      AND short_p.name NOT ILIKE 'Most%'
  LOOP
    RAISE NOTICE '[parish-cleanup] Removing "%" (%) → keeping "%" (%)',
      dup.dup_name, dup.dup_id, dup.keep_name, dup.keep_id;

    -- Move outstations to the keeper
    UPDATE outstations
       SET parish_id = dup.keep_id
     WHERE parish_id = dup.dup_id;

    -- Move youths
    UPDATE youths
       SET parish_id = dup.keep_id
     WHERE parish_id = dup.dup_id;

    -- Move leadership roles
    UPDATE youth_leadership_roles
       SET parish_id = dup.keep_id
     WHERE parish_id = dup.dup_id;

    -- Move events
    UPDATE events
       SET parish_id = dup.keep_id
     WHERE parish_id = dup.dup_id;

    -- Move event duty assignees
    UPDATE event_duty_assignees
       SET parish_id = dup.keep_id
     WHERE parish_id = dup.dup_id;

    -- Now safe to delete the duplicate
    DELETE FROM parishes WHERE id = dup.dup_id;
  END LOOP;
END $$;
