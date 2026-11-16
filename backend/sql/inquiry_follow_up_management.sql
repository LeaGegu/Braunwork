-- Apply after inquiry_management_enhancements.sql in the intended Supabase project.
-- This RPC replaces direct UPDATE access for follow-up changes; it preserves
-- the caller JWT for auth.uid() in the inquiry activity trigger.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_update_inquiry_follow_up(
  p_inquiry_id uuid,
  p_follow_up_at timestamptz,
  p_follow_up_note text
)
RETURNS TABLE (
  id uuid,
  follow_up_at timestamptz,
  follow_up_note text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  updated_row public.inquiries%ROWTYPE;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.staff_profiles AS caller
    WHERE caller.id = actor_id
      AND caller.is_active IS TRUE
      AND (
        caller.role = 'admin'
        OR (
          caller.role = 'staff'
          AND caller.can_manage_inquiries IS TRUE
        )
      )
  ) THEN
    RAISE EXCEPTION 'Inquiry management access is required'
      USING ERRCODE = '42501';
  END IF;

  IF (p_follow_up_at IS NULL AND p_follow_up_note IS NOT NULL)
    OR (
      p_follow_up_at IS NOT NULL
      AND (
        p_follow_up_note IS NULL
        OR pg_catalog.length(pg_catalog.btrim(p_follow_up_note)) = 0
        OR pg_catalog.length(pg_catalog.btrim(p_follow_up_note)) > 500
      )
    ) THEN
    RAISE EXCEPTION 'A valid follow-up date and note are required'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.inquiries AS inquiry
  SET follow_up_at = p_follow_up_at,
      follow_up_note = CASE
        WHEN p_follow_up_note IS NULL THEN NULL
        ELSE pg_catalog.btrim(p_follow_up_note)
      END,
      updated_at = pg_catalog.now()
  WHERE inquiry.id = p_inquiry_id
  RETURNING inquiry.* INTO updated_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inquiry not found'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT
    updated_row.id,
    updated_row.follow_up_at,
    updated_row.follow_up_note,
    updated_row.updated_at;
END
$function$;

REVOKE ALL
ON FUNCTION public.admin_update_inquiry_follow_up(uuid, timestamptz, text)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE
ON FUNCTION public.admin_update_inquiry_follow_up(uuid, timestamptz, text)
TO authenticated;

COMMIT;
