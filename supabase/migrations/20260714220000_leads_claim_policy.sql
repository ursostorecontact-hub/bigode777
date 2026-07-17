-- Permite que qualquer vendedor do tenant "pesque" (reivindique) um lead que
-- ainda não tem dono (assigned_to IS NULL). Antes, só quem já era dono do lead
-- (ou admin/gerente) conseguia atualizar — o que bloqueava a fila de leads.
DROP POLICY IF EXISTS "Tenant: update leads" ON public.leads;

CREATE POLICY "Tenant: update leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      assigned_to = auth.uid()
      OR assigned_to IS NULL
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );
