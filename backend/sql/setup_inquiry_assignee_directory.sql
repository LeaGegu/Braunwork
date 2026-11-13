BEGIN;

-- One-time migration: existing objects with these names are not replaced.
-- Run as the owner of public.staff_profiles with permission to create roles.
DO $preflight$
DECLARE
  sync_role_oid oid;
  role_is_safe boolean;
  profile_owner name;
BEGIN
  SELECT pg_catalog.pg_get_userbyid(relation.relowner)
  INTO profile_owner
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'staff_profiles'
    AND relation.relkind IN ('r', 'p');

  IF profile_owner IS DISTINCT FROM CURRENT_USER THEN
    RAISE EXCEPTION
      'Run this migration as the owner of public.staff_profiles';
  END IF;

  IF SESSION_USER IS DISTINCT FROM CURRENT_USER THEN
    RAISE EXCEPTION
      'Run this migration without a pre-existing SET ROLE so RESET ROLE returns to the table owner';
  END IF;

  IF CURRENT_USER = 'braunwork_assignee_sync' THEN
    RAISE EXCEPTION
      'The migration executor must not be braunwork_assignee_sync';
  END IF;

  SELECT role.oid
  INTO sync_role_oid
  FROM pg_catalog.pg_roles AS role
  WHERE role.rolname = 'braunwork_assignee_sync';

  IF sync_role_oid IS NULL THEN
    EXECUTE 'CREATE ROLE braunwork_assignee_sync NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS';
  ELSE
    SELECT
      NOT role.rolsuper
      AND NOT role.rolcanlogin
      AND NOT role.rolcreatedb
      AND NOT role.rolcreaterole
      AND NOT role.rolinherit
      AND NOT role.rolreplication
      AND NOT role.rolbypassrls
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_auth_members AS membership
        WHERE membership.roleid = sync_role_oid
           OR membership.member = sync_role_oid
      )
    INTO role_is_safe
    FROM pg_catalog.pg_roles AS role
    WHERE role.oid = sync_role_oid;

    IF role_is_safe IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION
        'Existing braunwork_assignee_sync role is not restricted; inspect it before running this migration';
    END IF;
  END IF;
END
$preflight$;

GRANT braunwork_assignee_sync TO CURRENT_USER;

CREATE SCHEMA braunwork_private;
REVOKE ALL ON SCHEMA braunwork_private
FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA braunwork_private
TO braunwork_assignee_sync;
GRANT CREATE ON SCHEMA braunwork_private
TO braunwork_assignee_sync;

CREATE TABLE public.inquiry_assignee_directory (
  id uuid PRIMARY KEY,
  full_name text
);

REVOKE ALL ON TABLE public.inquiry_assignee_directory
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.inquiry_assignee_directory TO authenticated;
GRANT USAGE ON SCHEMA public TO braunwork_assignee_sync;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.inquiry_assignee_directory
TO braunwork_assignee_sync;

ALTER TABLE public.inquiry_assignee_directory
ENABLE ROW LEVEL SECURITY;

CREATE POLICY inquiry_assignee_directory_sync_access
ON public.inquiry_assignee_directory
FOR ALL
TO braunwork_assignee_sync
USING (true)
WITH CHECK (true);

CREATE POLICY inquiry_assignee_directory_read_access
ON public.inquiry_assignee_directory
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.staff_profiles AS caller_profile
    WHERE caller_profile.id = auth.uid()
      AND caller_profile.is_active IS TRUE
      AND (
        caller_profile.role = 'admin'
        OR (
          caller_profile.role = 'staff'
          AND caller_profile.can_manage_inquiries IS TRUE
        )
      )
  )
  AND EXISTS (
    SELECT 1
    FROM public.inquiries AS visible_inquiry
    WHERE visible_inquiry.assigned_to = inquiry_assignee_directory.id
  )
);

GRANT SELECT (id, full_name, is_active)
ON public.staff_profiles
TO braunwork_assignee_sync;

CREATE POLICY inquiry_assignee_directory_seed_access
ON public.staff_profiles
FOR SELECT
TO braunwork_assignee_sync
USING (is_active IS TRUE);

SET LOCAL ROLE braunwork_assignee_sync;

CREATE FUNCTION braunwork_private.sync_inquiry_assignee_directory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.inquiry_assignee_directory
    WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.id IS DISTINCT FROM NEW.id THEN
      DELETE FROM public.inquiry_assignee_directory
      WHERE id = OLD.id;
    END IF;
  END IF;

  IF NEW.is_active IS TRUE THEN
    INSERT INTO public.inquiry_assignee_directory (id, full_name)
    VALUES (NEW.id, NEW.full_name)
    ON CONFLICT (id)
    DO UPDATE SET full_name = EXCLUDED.full_name;
  ELSE
    DELETE FROM public.inquiry_assignee_directory
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

DO $function_owner_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS proc
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = proc.pronamespace
    JOIN pg_catalog.pg_roles AS function_owner
      ON function_owner.oid = proc.proowner
    WHERE namespace.nspname = 'braunwork_private'
      AND proc.proname = 'sync_inquiry_assignee_directory'
      AND function_owner.rolname = 'braunwork_assignee_sync'
  ) THEN
    RAISE EXCEPTION
      'Trigger function was not created with the restricted owner';
  END IF;
END
$function_owner_check$;

RESET ROLE;

GRANT EXECUTE
ON FUNCTION braunwork_private.sync_inquiry_assignee_directory()
TO CURRENT_USER;

CREATE TRIGGER sync_inquiry_assignee_directory
AFTER INSERT OR UPDATE OF id, full_name, is_active OR DELETE
ON public.staff_profiles
FOR EACH ROW
EXECUTE FUNCTION braunwork_private.sync_inquiry_assignee_directory();

REVOKE ALL
ON FUNCTION braunwork_private.sync_inquiry_assignee_directory()
FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE
ON FUNCTION braunwork_private.sync_inquiry_assignee_directory()
FROM CURRENT_USER;

LOCK TABLE public.staff_profiles IN SHARE ROW EXCLUSIVE MODE;

SET LOCAL ROLE braunwork_assignee_sync;

DELETE FROM public.inquiry_assignee_directory AS directory_entry
WHERE NOT EXISTS (
  SELECT 1
  FROM public.staff_profiles AS profile
  WHERE profile.id = directory_entry.id
    AND profile.is_active IS TRUE
);

INSERT INTO public.inquiry_assignee_directory (id, full_name)
SELECT profile.id, profile.full_name
FROM public.staff_profiles AS profile
WHERE profile.is_active IS TRUE
ON CONFLICT (id)
DO UPDATE SET full_name = EXCLUDED.full_name;

RESET ROLE;

DROP POLICY inquiry_assignee_directory_seed_access
ON public.staff_profiles;
REVOKE SELECT (id, full_name, is_active)
ON public.staff_profiles
FROM braunwork_assignee_sync;

ALTER TABLE public.inquiry_assignee_directory
FORCE ROW LEVEL SECURITY;

REVOKE CREATE ON SCHEMA braunwork_private
FROM braunwork_assignee_sync;
REVOKE braunwork_assignee_sync FROM CURRENT_USER;

COMMIT;
