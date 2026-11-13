BEGIN;

DO $$
DECLARE
  arvin_user_id uuid := '3461549a-b780-4104-9bfe-995af18c2c48';
  arvin_email text := 'jordangeguna@gmail.com';
  inserted_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = arvin_user_id
      AND lower(email) = lower(arvin_email)
  ) THEN
    RAISE EXCEPTION 'Arvin Auth user ID and email do not match';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = arvin_user_id
      AND email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Arvin Auth user email must be confirmed before profile setup';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.staff_profiles
    WHERE id = arvin_user_id
  ) THEN
    RAISE EXCEPTION 'A staff profile already exists for this Auth user';
  END IF;

  INSERT INTO public.staff_profiles (
    id,
    full_name,
    role,
    can_manage_inquiries,
    is_active
  )
  VALUES (
    arvin_user_id,
    'Arvin',
    'admin',
    true,
    true
  );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count <> 1 THEN
    RAISE EXCEPTION 'Expected one staff profile, inserted %', inserted_count;
  END IF;
END
$$;

COMMIT;

-- Verify the created profile and its matching Auth email.
SELECT
  auth_user.id AS auth_user_id,
  auth_user.email,
  staff_profile.full_name,
  staff_profile.role,
  staff_profile.can_manage_inquiries,
  staff_profile.is_active
FROM auth.users AS auth_user
JOIN public.staff_profiles AS staff_profile
  ON staff_profile.id = auth_user.id
WHERE auth_user.id = '3461549a-b780-4104-9bfe-995af18c2c48'
  AND lower(auth_user.email) = lower('jordangeguna@gmail.com');
