
-- Fix 1: Prevent privilege escalation on user_roles
-- The ALL policy for admins covers INSERT, but non-admins have no explicit INSERT deny.
-- Add an explicit INSERT policy restricted to admins only.
CREATE POLICY "Only admins insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Also add explicit UPDATE policy for safety
CREATE POLICY "Only admins update roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: team_members is a VIEW, not a table, so RLS doesn't apply directly.
-- It inherits RLS from the underlying profiles table (security_invoker = true).
-- But the scanner sees no RLS on it. We can drop and recreate with explicit security.
-- Actually, views with security_invoker already enforce the querying user's RLS.
-- The real issue is the scanner doesn't understand views. We'll leave it as-is and mark it.
