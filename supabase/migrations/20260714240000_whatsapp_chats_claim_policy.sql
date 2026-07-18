-- Permite que a atribuição automática de conversa (feita ao pescar um lead) funcione:
-- antes, só quem já era dono da conversa (ou admin/gerente) conseguia atualizá-la,
-- bloqueando silenciosamente a tentativa de vincular a conversa ao vendedor que pescou.
DROP POLICY IF EXISTS "Tenant: update whatsapp chats" ON public.whatsapp_chats;

CREATE POLICY "Tenant: update whatsapp chats" ON public.whatsapp_chats
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        assigned_to = auth.uid()
        OR assigned_to IS NULL
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'manager')
      )
    )
  );
