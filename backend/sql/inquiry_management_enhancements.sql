BEGIN;

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_note text;

CREATE INDEX IF NOT EXISTS inquiries_follow_up_at_idx
  ON public.inquiries (follow_up_at)
  WHERE follow_up_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.inquiry_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inquiry_id uuid NOT NULL
    REFERENCES public.inquiries(id) ON DELETE CASCADE,
  actor_user_id uuid
    REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  actor_name text,
  activity_type text NOT NULL
    CHECK (activity_type IN (
      'status_changed',
      'assignment_changed',
      'follow_up_created',
      'follow_up_updated',
      'follow_up_removed'
    )),
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inquiry_activity_inquiry_created_idx
  ON public.inquiry_activity (inquiry_id, created_at, id);

ALTER TABLE public.inquiry_activity ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.inquiry_activity
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.inquiry_activity TO authenticated;

DROP POLICY IF EXISTS inquiry_activity_read_access
ON public.inquiry_activity;
CREATE POLICY inquiry_activity_read_access
ON public.inquiry_activity
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.staff_profiles AS caller
    WHERE caller.id = auth.uid()
      AND caller.is_active IS TRUE
      AND (
        caller.role = 'admin'
        OR (
          caller.role = 'staff'
          AND caller.can_manage_inquiries IS TRUE
        )
      )
  )
);

DROP POLICY IF EXISTS inquiry_assignee_directory_manager_read_access
ON public.inquiry_assignee_directory;
CREATE POLICY inquiry_assignee_directory_manager_read_access
ON public.inquiry_assignee_directory
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.staff_profiles AS caller
    WHERE caller.id = auth.uid()
      AND caller.is_active IS TRUE
      AND (
        caller.role = 'admin'
        OR (
          caller.role = 'staff'
          AND caller.can_manage_inquiries IS TRUE
        )
      )
  )
);

CREATE OR REPLACE FUNCTION public.record_inquiry_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  actor_display_name text;
BEGIN
  SELECT profile.full_name
  INTO actor_display_name
  FROM public.staff_profiles AS profile
  WHERE profile.id = actor_id;

  actor_display_name := COALESCE(actor_display_name, 'System');

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.inquiry_activity (
      inquiry_id,
      actor_user_id,
      actor_name,
      activity_type,
      previous_value,
      new_value
    )
    VALUES (
      NEW.id,
      actor_id,
      actor_display_name,
      'status_changed',
      pg_catalog.to_jsonb(OLD.status),
      pg_catalog.to_jsonb(NEW.status)
    );
  END IF;

  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO public.inquiry_activity (
      inquiry_id,
      actor_user_id,
      actor_name,
      activity_type,
      previous_value,
      new_value
    )
    VALUES (
      NEW.id,
      actor_id,
      actor_display_name,
      'assignment_changed',
      pg_catalog.to_jsonb(OLD.assigned_to),
      pg_catalog.to_jsonb(NEW.assigned_to)
    );
  END IF;

  IF OLD.follow_up_at IS DISTINCT FROM NEW.follow_up_at
    OR OLD.follow_up_note IS DISTINCT FROM NEW.follow_up_note THEN
    INSERT INTO public.inquiry_activity (
      inquiry_id,
      actor_user_id,
      actor_name,
      activity_type,
      previous_value,
      new_value
    )
    VALUES (
      NEW.id,
      actor_id,
      actor_display_name,
      CASE
        WHEN OLD.follow_up_at IS NULL AND NEW.follow_up_at IS NOT NULL
          THEN 'follow_up_created'
        WHEN OLD.follow_up_at IS NOT NULL AND NEW.follow_up_at IS NULL
          THEN 'follow_up_removed'
        ELSE 'follow_up_updated'
      END,
      pg_catalog.jsonb_build_object(
        'follow_up_at', OLD.follow_up_at,
        'follow_up_note', OLD.follow_up_note
      ),
      pg_catalog.jsonb_build_object(
        'follow_up_at', NEW.follow_up_at,
        'follow_up_note', NEW.follow_up_note
      )
    );
  END IF;

  RETURN NEW;
END
$function$;

REVOKE ALL
ON FUNCTION public.record_inquiry_activity()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS record_inquiry_activity
ON public.inquiries;
CREATE TRIGGER record_inquiry_activity
AFTER UPDATE OF status, assigned_to, follow_up_at, follow_up_note
ON public.inquiries
FOR EACH ROW
EXECUTE FUNCTION public.record_inquiry_activity();

DROP FUNCTION IF EXISTS public.admin_assign_inquiry(uuid, uuid, uuid);
CREATE FUNCTION public.admin_assign_inquiry(
  p_inquiry_id uuid,
  p_assigned_to uuid,
  p_expected_assigned_to uuid
)
RETURNS TABLE (
  id uuid,
  assigned_to uuid,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  current_assignee uuid;
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

  SELECT inquiry.assigned_to
  INTO current_assignee
  FROM public.inquiries AS inquiry
  WHERE inquiry.id = p_inquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inquiry not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF current_assignee IS DISTINCT FROM p_expected_assigned_to THEN
    RAISE EXCEPTION 'Inquiry assignment changed'
      USING ERRCODE = 'BW002';
  END IF;

  IF p_assigned_to IS NOT NULL THEN
    PERFORM 1
    FROM public.staff_profiles AS assignee
    WHERE assignee.id = p_assigned_to
      AND assignee.is_active IS TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Assignee must be an active staff member'
        USING ERRCODE = 'BW003';
    END IF;
  END IF;

  RETURN QUERY
  UPDATE public.inquiries AS inquiry
  SET assigned_to = p_assigned_to,
      updated_at = pg_catalog.now()
  WHERE inquiry.id = p_inquiry_id
  RETURNING inquiry.id, inquiry.assigned_to, inquiry.updated_at;
END
$function$;

REVOKE ALL
ON FUNCTION public.admin_assign_inquiry(uuid, uuid, uuid)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE
ON FUNCTION public.admin_assign_inquiry(uuid, uuid, uuid)
TO authenticated;

COMMIT;
