GRANT SELECT ON TABLE public.staff_profiles TO authenticated;

CREATE POLICY "Authenticated users can read their own active staff profile"
ON public.staff_profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  AND is_active = true
);
