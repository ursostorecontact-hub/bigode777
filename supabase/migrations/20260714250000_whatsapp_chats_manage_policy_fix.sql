-- Existe uma segunda política mais antiga ("Tenant: manage whatsapp chats", tipo ALL)
-- cujo WITH CHECK só permitia admin/gerente confirmarem a mudança — mesmo a política
-- de UPDATE já permitindo a tentativa, essa outra bloqueava a gravação final quando um
-- vendedor tentava se auto-atribuir uma conversa sem dono.
DROP POLICY IF EXISTS "Tenant: manage whatsapp chats" ON public.whatsapp_chats;

CREATE POLICY "Tenant: manage whatsapp chats" ON public.whatsapp_chats
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (
      tenant_id = current_tenant_id()
      AND (
        assigned_to = auth.uid()
        OR assigned_to IS NULL
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'manager'::app_role)
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      tenant_id = current_tenant_id()
      AND (
        assigned_to = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'manager'::app_role)
      )
    )
  );
