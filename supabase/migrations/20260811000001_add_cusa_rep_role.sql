-- Add "CUSA Rep" to the canonical leadership role types list.
INSERT INTO public.leadership_role_types (name)
VALUES ('CUSA Rep')
ON CONFLICT (name) DO NOTHING;
