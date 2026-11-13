BEGIN;

ALTER TABLE public.staff_profiles
  DROP CONSTRAINT staff_profiles_role_check;

ALTER TABLE public.staff_profiles
  ADD CONSTRAINT staff_profiles_role_check
  CHECK (role IN ('admin', 'staff'));

COMMIT;

-- Verify the final role constraint definition.
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.staff_profiles'::regclass
  AND conname = 'staff_profiles_role_check'
  AND contype = 'c';

-- Extract the allowed role values from the final CHECK constraint.
SELECT role_match[1] AS allowed_role
FROM pg_constraint
CROSS JOIN LATERAL regexp_matches(
  pg_get_constraintdef(oid),
  $$'([^']+)'$$,
  'g'
) AS role_match
WHERE conrelid = 'public.staff_profiles'::regclass
  AND conname = 'staff_profiles_role_check'
  AND contype = 'c'
ORDER BY allowed_role;
