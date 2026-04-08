
-- Drop the recursive policy
DROP POLICY IF EXISTS "Tenant admins manage members" ON public.tenant_members;

-- Recreate without recursion: use current_tenant_id() which is SECURITY DEFINER
CREATE POLICY "Tenant admins manage members"
ON public.tenant_members
FOR ALL
TO authenticated
USING (
  is_super_admin()
  OR (
    tenant_id = current_tenant_id()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
);
