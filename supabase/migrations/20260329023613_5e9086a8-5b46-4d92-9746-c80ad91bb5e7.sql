
-- Fix 1: Add INSERT policy on profiles - only allow inserting own profile
-- (The handle_new_user trigger uses SECURITY DEFINER and bypasses RLS)
CREATE POLICY "Users insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Fix 2: The privilege escalation warning is a false positive.
-- The admin is seeded via handle_new_user trigger (SECURITY DEFINER) which bypasses RLS.
-- The validate_role_insert trigger prevents non-admins from self-assigning privileged roles.
-- No action needed - this is secure by design.
