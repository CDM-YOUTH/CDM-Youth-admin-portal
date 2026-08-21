-- Fixed display order for leadership roles (Coordinator first, down through the
-- standard cabinet positions), instead of the incidental alphabetical/creation order.
-- Roles not in the canonical list (custom ones added later) default to 999 and fall
-- back to alphabetical among themselves — i.e. "and so on" at the end.

ALTER TABLE public.leadership_role_types
  ADD COLUMN sort_order integer NOT NULL DEFAULT 999;

UPDATE public.leadership_role_types SET sort_order = 1  WHERE name = 'Coordinator';
UPDATE public.leadership_role_types SET sort_order = 2  WHERE name = 'Vice Coordinator';
UPDATE public.leadership_role_types SET sort_order = 3  WHERE name = 'Secretary';
UPDATE public.leadership_role_types SET sort_order = 4  WHERE name = 'Vice Secretary';
UPDATE public.leadership_role_types SET sort_order = 5  WHERE name = 'Treasurer';
UPDATE public.leadership_role_types SET sort_order = 6  WHERE name = 'Organising Secretary';
UPDATE public.leadership_role_types SET sort_order = 7  WHERE name = 'CUSA Rep';
UPDATE public.leadership_role_types SET sort_order = 8  WHERE name = 'Liturgist';
UPDATE public.leadership_role_types SET sort_order = 9  WHERE name = 'Discipline Master/Mistress';
UPDATE public.leadership_role_types SET sort_order = 10 WHERE name = 'Choir Master';
