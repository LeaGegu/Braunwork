BEGIN;

CREATE OR REPLACE FUNCTION public.admin_update_staff_profile(
  p_user_id uuid,
  p_full_name text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_can_manage_inquiries boolean DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  full_name text,
  role text,
  can_manage_inquiries boolean,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  current_role text;
  current_is_active boolean;
  next_role text;
  next_is_active boolean;
  active_admin_count bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A staff user ID is required';
  END IF;

  IF p_role IS NOT NULL AND p_role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'The staff role is invalid';
  END IF;

  IF p_full_name IS NULL
    AND p_role IS NULL
    AND p_is_active IS NULL
    AND p_can_manage_inquiries IS NULL THEN
    RAISE EXCEPTION 'At least one staff profile field is required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(710249834, 1);

  SELECT profile.role, profile.is_active
  INTO current_role, current_is_active
  FROM public.staff_profiles AS profile
  WHERE profile.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  next_role := COALESCE(p_role, current_role);
  next_is_active := COALESCE(p_is_active, current_is_active);

  IF current_role = 'admin'
    AND current_is_active IS TRUE
    AND (next_role <> 'admin' OR next_is_active IS NOT TRUE) THEN
    SELECT count(*)
    INTO active_admin_count
    FROM public.staff_profiles AS profile
    WHERE profile.role = 'admin'
      AND profile.is_active IS TRUE;

    IF active_admin_count <= 1 THEN
      RAISE EXCEPTION 'At least one active administrator must remain'
        USING ERRCODE = 'BW001';
    END IF;
  END IF;

  RETURN QUERY
  UPDATE public.staff_profiles AS profile
  SET full_name = COALESCE(p_full_name, profile.full_name),
      role = COALESCE(p_role, profile.role),
      is_active = COALESCE(p_is_active, profile.is_active),
      can_manage_inquiries = COALESCE(
        p_can_manage_inquiries,
        profile.can_manage_inquiries
      )
  WHERE profile.id = p_user_id
  RETURNING
    profile.id,
    profile.full_name,
    profile.role,
    profile.can_manage_inquiries,
    profile.is_active,
    profile.created_at;
END
$function$;

REVOKE ALL
ON FUNCTION public.admin_update_staff_profile(uuid, text, text, boolean, boolean)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
ON FUNCTION public.admin_update_staff_profile(uuid, text, text, boolean, boolean)
TO service_role;

COMMIT;
