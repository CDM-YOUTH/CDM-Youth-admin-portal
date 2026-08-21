-- The previous migration (20260821000002) added leadership_role_types.sort_order and
-- the app tried to order youth_leadership_roles by it via a PostgREST embedded-table
-- order (`order=role_type(sort_order)`). That only ever reorders the *nested* role_type
-- object within each row — PostgREST never uses it to reorder the parent query's rows.
-- So the roster still came back in start_date order regardless of role.
--
-- Fix: denormalize the sort key onto youth_leadership_roles itself, kept in sync by
-- trigger, so the app can order by a plain top-level column instead.

ALTER TABLE public.youth_leadership_roles
  ADD COLUMN role_sort_order integer NOT NULL DEFAULT 999;

UPDATE public.youth_leadership_roles ylr
SET role_sort_order = rt.sort_order
FROM public.leadership_role_types rt
WHERE ylr.role_id = rt.id;

-- Keep it in sync whenever a row is inserted or its role_id changes.
CREATE OR REPLACE FUNCTION public.sync_leadership_role_sort_order()
RETURNS trigger AS $$
BEGIN
  SELECT sort_order INTO NEW.role_sort_order
  FROM public.leadership_role_types
  WHERE id = NEW.role_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_leadership_role_sort_order ON public.youth_leadership_roles;
CREATE TRIGGER trg_sync_leadership_role_sort_order
  BEFORE INSERT OR UPDATE OF role_id ON public.youth_leadership_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_leadership_role_sort_order();

-- Keep it in sync if a role type's own sort_order is edited later.
CREATE OR REPLACE FUNCTION public.cascade_leadership_role_sort_order()
RETURNS trigger AS $$
BEGIN
  UPDATE public.youth_leadership_roles
  SET role_sort_order = NEW.sort_order
  WHERE role_id = NEW.id AND role_sort_order IS DISTINCT FROM NEW.sort_order;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_leadership_role_sort_order ON public.leadership_role_types;
CREATE TRIGGER trg_cascade_leadership_role_sort_order
  AFTER UPDATE OF sort_order ON public.leadership_role_types
  FOR EACH ROW EXECUTE FUNCTION public.cascade_leadership_role_sort_order();
