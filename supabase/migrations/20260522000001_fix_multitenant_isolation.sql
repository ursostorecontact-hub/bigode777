-- 2026-05-22: Fix multi-tenant RLS isolation for WhatsApp tables
--
-- ROOT CAUSE: The initial migration (20260408100532) created policies
-- "Admins manage all chats/messages" WITHOUT a tenant_id check.
-- The later fix migration (20260410000000) tried to drop them using the
-- WRONG policy names, so the leaky policies remained active alongside
-- the new tenant-scoped ones. In Postgres, RLS policies are OR-ed, so
-- the tenant-less "admin" policies allowed admin/manager users to see
-- data from ALL tenants.
--
-- ALSO: "Tenant: read whatsapp messages" was too permissive — it allowed
-- ANY authenticated user in the tenant to read ALL messages instead of
-- only those from chats assigned to them.

-- ═══════════════════════════════════════════════════════════════════════
-- WHATSAPP_CHATS
-- ═══════════════════════════════════════════════════════════════════════

-- Drop every known policy variant (old names + new names = clean slate)
DROP POLICY IF EXISTS "Admins manage all chats"          ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Salespeople read assigned chats"   ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Salespeople update assigned chats" ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Users read assigned chats"         ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Users update assigned chats"       ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Admins manage chats"               ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Webhook insert chats"              ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Tenant: read whatsapp chats"       ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Tenant: insert whatsapp chats"     ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Tenant: update whatsapp chats"     ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Tenant: delete whatsapp chats"     ON public.whatsapp_chats;

-- SELECT: tenant-scoped + (assigned_to OR admin/manager) + super_admin bypass
CREATE POLICY "Tenant: read whatsapp chats" ON public.whatsapp_chats
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        assigned_to = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'manager')
      )
    )
  );

-- INSERT: service role inserts via edge functions; authenticated users only for own tenant
CREATE POLICY "Tenant: insert whatsapp chats" ON public.whatsapp_chats
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR tenant_id = public.current_tenant_id()
  );

-- UPDATE: same access rules as SELECT (can only update chats you can see)
CREATE POLICY "Tenant: update whatsapp chats" ON public.whatsapp_chats
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        assigned_to = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'manager')
      )
    )
  );

-- DELETE: admin/manager of own tenant only
CREATE POLICY "Tenant: delete whatsapp chats" ON public.whatsapp_chats
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- WHATSAPP_MESSAGES
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admins manage all messages"                     ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Salespeople read messages from assigned chats"  ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Salespeople insert messages to assigned chats"  ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users read messages in assigned chats"          ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users send messages to assigned chats"          ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Admins manage messages"                         ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Tenant: read whatsapp messages"                 ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Tenant: insert whatsapp messages"               ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Tenant: update whatsapp messages"               ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Tenant: delete whatsapp messages"               ON public.whatsapp_messages;

-- SELECT: tenant-scoped + (admin/manager OR chat is assigned to user)
CREATE POLICY "Tenant: read whatsapp messages" ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'manager')
        OR EXISTS (
          SELECT 1 FROM public.whatsapp_chats c
          WHERE c.id = whatsapp_messages.chat_id
            AND c.assigned_to = auth.uid()
        )
      )
    )
  );

-- INSERT: tenant-scoped (webhook/sync use service_role which bypasses RLS)
CREATE POLICY "Tenant: insert whatsapp messages" ON public.whatsapp_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR tenant_id = public.current_tenant_id()
  );

-- UPDATE: admin/manager or assigned user (e.g. marking messages read)
CREATE POLICY "Tenant: update whatsapp messages" ON public.whatsapp_messages
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'manager')
        OR EXISTS (
          SELECT 1 FROM public.whatsapp_chats c
          WHERE c.id = whatsapp_messages.chat_id
            AND c.assigned_to = auth.uid()
        )
      )
    )
  );

-- DELETE: admin/manager only
CREATE POLICY "Tenant: delete whatsapp messages" ON public.whatsapp_messages
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- WHATSAPP_INSTANCES
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Tenant: read whatsapp instances"   ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Tenant: manage whatsapp instances" ON public.whatsapp_instances;

CREATE POLICY "Tenant: read whatsapp instances" ON public.whatsapp_instances
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'manager')
        OR EXISTS (
          SELECT 1 FROM public.whatsapp_assignments wa
          WHERE wa.whatsapp_instance_id = whatsapp_instances.id
            AND wa.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Tenant: manage whatsapp instances" ON public.whatsapp_instances
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- WHATSAPP_ASSIGNMENTS — eliminate conflicting old policies
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admins manage whatsapp_assignments"  ON public.whatsapp_assignments;
DROP POLICY IF EXISTS "Users read own whatsapp_assignments"  ON public.whatsapp_assignments;
DROP POLICY IF EXISTS "Tenant: read whatsapp assignments"    ON public.whatsapp_assignments;
DROP POLICY IF EXISTS "Tenant: manage whatsapp assignments"  ON public.whatsapp_assignments;

CREATE POLICY "Tenant: read whatsapp assignments" ON public.whatsapp_assignments
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'manager')
      )
    )
  );

CREATE POLICY "Tenant: manage whatsapp assignments" ON public.whatsapp_assignments
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    )
  );
