-- Permite que qualquer vendedor do tenant VEJA leads sem dono (assigned_to IS NULL),
-- não só os que já são dele. Sem isso, a Fila de Leads aparecia vazia pra vendedores,
-- mesmo com leads esperando — porque a política de leitura já bloqueava a visibilidade
-- antes mesmo de chegar na tela.
DROP POLICY IF EXISTS "Tenant: read leads" ON public.leads;

CREATE POLICY "Tenant: read leads" ON public.leads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      assigned_to = auth.uid()
      OR assigned_to IS NULL
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );
