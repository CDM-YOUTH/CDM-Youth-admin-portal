-- ================================================================
-- Generic, data-driven permission check — reads role_permissions
-- at query time instead of hardcoding role names in RLS policies.
-- Replaces leader_in_scope() with a version that works for any role,
-- not just 'leader', and matches org scope at up to 3 levels.
-- ================================================================
CREATE OR REPLACE FUNCTION public.can_access(
  _module text,
  _action text,                        -- 'view' | 'create' | 'edit' | 'delete'
  _row_deanery_id uuid DEFAULT NULL,
  _row_parish_id uuid DEFAULT NULL,
  _row_outstation_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role text;
  _perm record;
BEGIN
  SELECT role INTO _role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  IF _role IS NULL THEN
    RETURN false;
  END IF;

  SELECT can_view, can_create, can_edit, can_delete, scoped
    INTO _perm
    FROM public.role_permissions
   WHERE role = _role AND module = _module;

  IF _perm IS NULL THEN
    RETURN false;
  END IF;

  IF (_action = 'view'   AND NOT _perm.can_view)
     OR (_action = 'create' AND NOT _perm.can_create)
     OR (_action = 'edit'   AND NOT _perm.can_edit)
     OR (_action = 'delete' AND NOT _perm.can_delete)
  THEN
    RETURN false;
  END IF;

  IF NOT _perm.scoped THEN
    RETURN true;
  END IF;

  -- Scoped: the caller's own assigned org (if any) must match the row's.
  -- A caller with no scope at a given level (NULL) is unrestricted at
  -- that level — same convention applyCallerScope() uses server-side.
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.deanery_id    IS NULL OR p.deanery_id    = _row_deanery_id)
      AND (p.parish_id     IS NULL OR p.parish_id     = _row_parish_id)
      AND (p.outstation_id IS NULL OR p.outstation_id = _row_outstation_id)
  );
END;
$$;
