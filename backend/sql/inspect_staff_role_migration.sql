-- Inspect CHECK constraints on public.staff_profiles that reference the role column.
SELECT
  constraint_info.conname AS constraint_name,
  pg_get_constraintdef(constraint_info.oid) AS constraint_definition
FROM pg_constraint AS constraint_info
WHERE constraint_info.conrelid = 'public.staff_profiles'::regclass
  AND constraint_info.contype = 'c'
  AND pg_get_constraintdef(constraint_info.oid) ILIKE '%role%';

-- Count staff profiles grouped by their current role.
SELECT
  role,
  count(*) AS profile_count
FROM public.staff_profiles
GROUP BY role
ORDER BY role;

-- Count profiles whose role is NULL.
SELECT
  count(*) AS null_role_count
FROM public.staff_profiles
WHERE role IS NULL;

-- Inspect the role column's data type, nullability, and default expression.
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'staff_profiles'
  AND column_name = 'role';
