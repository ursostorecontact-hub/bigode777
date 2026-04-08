
-- Drop old policies
DROP POLICY IF EXISTS "Admins manage automations" ON public.automations;
DROP POLICY IF EXISTS "Admins read automations" ON public.automations;

-- Tenant-scoped policies
CREATE POLICY "Tenant admins can read automations"
ON public.automations FOR SELECT TO authenticated
USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant admins can insert automations"
ON public.automations FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.current_tenant_id()
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Tenant admins can update automations"
ON public.automations FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Tenant admins can delete automations"
ON public.automations FOR DELETE TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  AND public.has_role(auth.uid(), 'admin')
);

-- Default tenant_id on insert
ALTER TABLE public.automations ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
