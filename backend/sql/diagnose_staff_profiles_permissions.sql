-- Check whether anon can access the public schema and select from the table.
SELECT
  has_schema_privilege('anon', 'public', 'USAGE') AS anon_has_public_schema_usage,
  has_table_privilege('anon', 'public.staff_profiles', 'SELECT')
    AS anon_has_staff_profiles_select;

-- Show the table owner and any table-level grants for the named API roles.
-- Roles without a matching information_schema grant are included with NULL grant fields.
WITH target_roles(role_name) AS (
  VALUES ('anon'), ('authenticated'), ('service_role')
)
SELECT
  table_owner.rolname AS table_owner,
  target_roles.role_name,
  grants.privilege_type,
  grants.is_grantable,
  grants.grantor
FROM pg_class AS table_class
JOIN pg_namespace AS table_schema
  ON table_schema.oid = table_class.relnamespace
JOIN pg_roles AS table_owner
  ON table_owner.oid = table_class.relowner
CROSS JOIN target_roles
LEFT JOIN information_schema.role_table_grants AS grants
  ON grants.table_schema = table_schema.nspname
  AND grants.table_name = table_class.relname
  AND grants.grantee = target_roles.role_name
WHERE table_schema.nspname = 'public'
  AND table_class.relname = 'staff_profiles'
  AND table_class.relkind IN ('r', 'p')
ORDER BY target_roles.role_name, grants.privilege_type;

-- Check whether row-level security is enabled and forced on the table.
SELECT
  table_class.relrowsecurity AS row_level_security_enabled,
  table_class.relforcerowsecurity AS row_level_security_forced
FROM pg_class AS table_class
JOIN pg_namespace AS table_schema
  ON table_schema.oid = table_class.relnamespace
WHERE table_schema.nspname = 'public'
  AND table_class.relname = 'staff_profiles'
  AND table_class.relkind IN ('r', 'p');

-- List all row-level security policies defined for the table.
SELECT
  policyname,
  cmd AS command,
  roles,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'staff_profiles'
ORDER BY policyname;
