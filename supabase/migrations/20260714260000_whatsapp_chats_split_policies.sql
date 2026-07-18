-- A política "ALL" anterior misturava SELECT/INSERT/UPDATE/DELETE numa regra só.
-- Ao permitir "assigned_to IS NULL" nela pra viabilizar a pesca (UPDATE), isso também
-- liberou a VISUALIZAÇÃO (SELECT) de conversas sem dono pra qualquer vendedor —
-- o que não era a intenção (conversa deveria ficar escondida até ser pescada).
-- Aqui, separamos em políticas específicas por ação, cada uma com a regra certa.

DROP POLICY IF EXISTS "Tenant: manage whatsapp chats" ON public.whatsapp_chats;

-- SELECT: só vê conversas já atribuídas a si mesmo (ou admin/gerente vê tudo).
-- Conversa sem dono fica ESCONDIDA daqui — só aparece depois de pescada.
CREATE POLICY "Tenant: select whatsapp chats" ON public.whatsapp_chats
  FOR SELECT TO authenticated
  USING (
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

-- INSERT: mantém como antes (na prática, quem cria é o webhook, com chave de serviço,
-- que ignora RLS de qualquer forma — isso aqui é só para chamadas autenticadas normais).
CREATE POLICY "Tenant: insert whatsapp chats manage" ON public.whatsapp_chats
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR (
      tenant_id = current_tenant_id()
      AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
    )
  );

-- DELETE: só admin/gerente (igual era antes).
CREATE POLICY "Tenant: delete whatsapp chats manage" ON public.whatsapp_chats
  FOR DELETE TO authenticated
  USING (
    is_super_admin()
    OR (
      tenant_id = current_tenant_id()
      AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
    )
  );
