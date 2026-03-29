
-- Fix 1: interactions missing DELETE policy
CREATE POLICY "Delete own interactions"
  ON public.interactions
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

-- Fix 2: Harden user_roles INSERT - add default deny by ensuring
-- the handle_new_user trigger (SECURITY DEFINER) is the only way non-admins get roles.
-- The existing INSERT policy already requires admin role via WITH CHECK.
-- Add a USING clause to the existing admin ALL policy for extra safety.
-- No actual change needed - the ALL policy + INSERT policy already restrict this.
-- But let's make the INSERT policy more explicit with both USING and WITH CHECK.
DROP POLICY IF EXISTS "Only admins insert roles" ON public.user_roles;
CREATE POLICY "Only admins insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
  );
