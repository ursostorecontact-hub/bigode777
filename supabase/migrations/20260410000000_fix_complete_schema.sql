-- ============================================================
-- COMPLETE SCHEMA FIX
-- Fixes all issues after database recreation from scratch:
-- 1. Add DEFAULT current_tenant_id() to all tenant_id columns
-- 2. Update RLS policies to be tenant-scoped
-- 3. Add trigger to auto-initialize tenant data on tenant creation
-- 4. Fix team_members view to be tenant-scoped
-- 5. Fix handle_new_user to also set tenant_id on profile
-- 6. Add missing get_team_members function
-- ============================================================

-- ============================================================
-- STEP 1: Add DEFAULT current_tenant_id() to all tenant_id columns
-- ============================================================

ALTER TABLE public.leads
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.clients
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.tasks
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.interactions
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.settings
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.pipeline_stages
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.lead_sources
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.facebook_webhooks
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.whatsapp_chats
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.whatsapp_messages
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.whatsapp_instances
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.whatsapp_assignments
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.profiles
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.user_labels
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.label_assignments
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

-- ============================================================
-- STEP 2: Fix handle_new_user to set tenant_id on profile
--         (called after register-tenant edge function sets tenant membership)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert default salesperson role (edge function create-user may override this)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'salesperson')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 3: Tenant auto-initialization trigger
-- Creates default settings, pipeline_stages, lead_sources for each new tenant
-- ============================================================

CREATE OR REPLACE FUNCTION public.initialize_tenant_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create default settings row for this tenant
  INSERT INTO public.settings (tenant_id, company_name)
  VALUES (NEW.id, NEW.name)
  ON CONFLICT DO NOTHING;

  -- Create default pipeline stages for this tenant
  INSERT INTO public.pipeline_stages (tenant_id, name, "order", color) VALUES
    (NEW.id, 'Novo',             1, '#3b82f6'),
    (NEW.id, 'Contactado',       2, '#f59e0b'),
    (NEW.id, 'Negociando',       3, '#8b5cf6'),
    (NEW.id, 'Proposta Enviada', 4, '#06b6d4'),
    (NEW.id, 'Ganho',            5, '#22c55e'),
    (NEW.id, 'Perdido',          6, '#ef4444')
  ON CONFLICT DO NOTHING;

  -- Create default lead sources for this tenant
  INSERT INTO public.lead_sources (tenant_id, name) VALUES
    (NEW.id, 'Instagram'),
    (NEW.id, 'WhatsApp'),
    (NEW.id, 'Website'),
    (NEW.id, 'Indicação'),
    (NEW.id, 'Facebook'),
    (NEW.id, 'Google'),
    (NEW.id, 'Outro')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_tenant_created ON public.tenants;
CREATE TRIGGER on_tenant_created
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.initialize_tenant_data();

-- ============================================================
-- STEP 4: Update RLS policies to be tenant-scoped
-- ============================================================

-- ---------- LEADS ----------
DROP POLICY IF EXISTS "Salesperson reads own leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated insert leads" ON public.leads;
DROP POLICY IF EXISTS "Salesperson updates own leads" ON public.leads;
DROP POLICY IF EXISTS "Admin deletes leads" ON public.leads;

CREATE POLICY "Tenant: read leads" ON public.leads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      assigned_to = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );

CREATE POLICY "Tenant: insert leads" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant: update leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      assigned_to = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );

CREATE POLICY "Tenant: delete leads" ON public.leads
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

-- ---------- CLIENTS ----------
DROP POLICY IF EXISTS "Read clients" ON public.clients;
DROP POLICY IF EXISTS "Insert clients" ON public.clients;
DROP POLICY IF EXISTS "Update clients" ON public.clients;
DROP POLICY IF EXISTS "Delete clients" ON public.clients;

CREATE POLICY "Tenant: read clients" ON public.clients
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant: insert clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant: update clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant: delete clients" ON public.clients
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

-- ---------- TASKS ----------
DROP POLICY IF EXISTS "Read own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Delete tasks" ON public.tasks;

CREATE POLICY "Tenant: read tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      assigned_to = auth.uid()
      OR created_by = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );

CREATE POLICY "Tenant: insert tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "Tenant: update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      assigned_to = auth.uid()
      OR created_by = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Tenant: delete tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      created_by = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- ---------- INTERACTIONS ----------
DROP POLICY IF EXISTS "Read interactions" ON public.interactions;
DROP POLICY IF EXISTS "Insert interactions" ON public.interactions;

CREATE POLICY "Tenant: read interactions" ON public.interactions
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant: insert interactions" ON public.interactions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND created_by = auth.uid()
  );

-- ---------- PIPELINE STAGES ----------
DROP POLICY IF EXISTS "Authenticated read stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Admins manage stages" ON public.pipeline_stages;

CREATE POLICY "Tenant: read pipeline stages" ON public.pipeline_stages
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant: manage pipeline stages" ON public.pipeline_stages
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_role(auth.uid(), 'admin')
  );

-- ---------- LEAD SOURCES ----------
DROP POLICY IF EXISTS "Authenticated read sources" ON public.lead_sources;
DROP POLICY IF EXISTS "Admins manage sources" ON public.lead_sources;

CREATE POLICY "Tenant: read lead sources" ON public.lead_sources
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant: manage lead sources" ON public.lead_sources
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_role(auth.uid(), 'admin')
  );

-- ---------- SETTINGS ----------
DROP POLICY IF EXISTS "Admins read settings" ON public.settings;
DROP POLICY IF EXISTS "Admins manage settings" ON public.settings;

CREATE POLICY "Tenant: read settings" ON public.settings
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant: insert settings" ON public.settings
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Tenant: update settings" ON public.settings
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_role(auth.uid(), 'admin')
  );

-- ---------- PROFILES ----------
-- Keep existing policies but add tenant-scoped select for non-admin reads
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins managers read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin delete profiles" ON public.profiles;

CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Tenant: read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "System insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------- WHATSAPP INSTANCES ----------
DROP POLICY IF EXISTS "Admins manage whatsapp instances" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Assigned users read whatsapp instances" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Users read assigned whatsapp instances" ON public.whatsapp_instances;

CREATE POLICY "Tenant: read whatsapp instances" ON public.whatsapp_instances
  FOR SELECT TO authenticated
  USING (
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
  );

CREATE POLICY "Tenant: manage whatsapp instances" ON public.whatsapp_instances
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

-- ---------- WHATSAPP CHATS ----------
DROP POLICY IF EXISTS "Users read assigned chats" ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Users update assigned chats" ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Admins manage chats" ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Webhook insert chats" ON public.whatsapp_chats;

CREATE POLICY "Tenant: read whatsapp chats" ON public.whatsapp_chats
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      assigned_to = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );

CREATE POLICY "Tenant: insert whatsapp chats" ON public.whatsapp_chats
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant: update whatsapp chats" ON public.whatsapp_chats
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant: delete whatsapp chats" ON public.whatsapp_chats
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

-- ---------- WHATSAPP MESSAGES ----------
DROP POLICY IF EXISTS "Users read messages in assigned chats" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users send messages to assigned chats" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Admins manage messages" ON public.whatsapp_messages;

CREATE POLICY "Tenant: read whatsapp messages" ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant: insert whatsapp messages" ON public.whatsapp_messages
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant: update whatsapp messages" ON public.whatsapp_messages
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- ---------- WHATSAPP ASSIGNMENTS ----------
DROP POLICY IF EXISTS "Admins manage whatsapp assignments" ON public.whatsapp_assignments;
DROP POLICY IF EXISTS "Users read own assignments" ON public.whatsapp_assignments;

CREATE POLICY "Tenant: read whatsapp assignments" ON public.whatsapp_assignments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );

CREATE POLICY "Tenant: manage whatsapp assignments" ON public.whatsapp_assignments
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

-- ---------- FACEBOOK WEBHOOKS ----------
DROP POLICY IF EXISTS "Admins manage facebook webhooks" ON public.facebook_webhooks;

CREATE POLICY "Tenant: manage facebook webhooks" ON public.facebook_webhooks
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Tenant: insert facebook webhooks" ON public.facebook_webhooks
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- ============================================================
-- STEP 5: Fix team_members view to be tenant-scoped
-- ============================================================

DROP VIEW IF EXISTS public.team_members;

CREATE OR REPLACE VIEW public.team_members
WITH (security_invoker = true)
AS
  SELECT p.id, p.full_name, p.email, p.avatar_url, p.active, p.tenant_id
  FROM public.profiles p
  WHERE p.active = true
    AND p.tenant_id = public.current_tenant_id();

GRANT SELECT ON public.team_members TO authenticated;

-- ============================================================
-- STEP 6: get_team_members function (used by SuperAdminPage)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_team_members(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  active BOOLEAN,
  role TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.avatar_url,
    p.active,
    COALESCE(ur.role::TEXT, 'salesperson') AS role
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.tenant_id = COALESCE(p_tenant_id, public.current_tenant_id())
    AND (
      public.is_super_admin()
      OR p.tenant_id = public.current_tenant_id()
    )
  ORDER BY p.full_name;
$$;

-- ============================================================
-- STEP 7: Realtime publication (idempotent)
-- ============================================================

DO $$
BEGIN
  -- Ensure tables are in realtime publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chats;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END;
$$;

-- ============================================================
-- STEP 8: Backfill existing tenants with default data if missing
-- ============================================================

-- Settings: create missing rows for existing tenants
INSERT INTO public.settings (tenant_id, company_name)
SELECT t.id, t.name
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.settings s WHERE s.tenant_id = t.id
)
ON CONFLICT DO NOTHING;

-- Pipeline stages: create missing rows for existing tenants
INSERT INTO public.pipeline_stages (tenant_id, name, "order", color)
SELECT t.id, v.name, v.ord, v.color
FROM public.tenants t
CROSS JOIN (VALUES
  ('Novo',             1, '#3b82f6'),
  ('Contactado',       2, '#f59e0b'),
  ('Negociando',       3, '#8b5cf6'),
  ('Proposta Enviada', 4, '#06b6d4'),
  ('Ganho',            5, '#22c55e'),
  ('Perdido',          6, '#ef4444')
) AS v(name, ord, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pipeline_stages ps WHERE ps.tenant_id = t.id
)
ON CONFLICT DO NOTHING;

-- Lead sources: create missing rows for existing tenants
INSERT INTO public.lead_sources (tenant_id, name)
SELECT t.id, v.name
FROM public.tenants t
CROSS JOIN (VALUES
  ('Instagram'), ('WhatsApp'), ('Website'), ('Indicação'),
  ('Facebook'), ('Google'), ('Outro')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.lead_sources ls WHERE ls.tenant_id = t.id
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 9: Fix NULL tenant_ids on existing data
-- (backfill tenant_id from tenant_members for orphaned records)
-- ============================================================

-- Backfill leads
UPDATE public.leads l
SET tenant_id = tm.tenant_id
FROM public.tenant_members tm
WHERE l.tenant_id IS NULL
  AND (l.assigned_to = tm.user_id OR l.assigned_to IS NULL)
  AND l.tenant_id IS NULL
  AND tm.role IN ('owner', 'admin');

-- Backfill clients
UPDATE public.clients c
SET tenant_id = (
  SELECT l.tenant_id FROM public.leads l WHERE l.id = c.lead_id
)
WHERE c.tenant_id IS NULL AND c.lead_id IS NOT NULL;

-- ============================================================
-- STEP 10: Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_leads_tenant_assigned ON public.leads(tenant_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON public.tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_interactions_tenant ON public.interactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settings_tenant ON public.settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_tenant ON public.pipeline_stages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_sources_tenant ON public.lead_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_tenant ON public.whatsapp_chats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_tenant ON public.whatsapp_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_tenant ON public.whatsapp_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles(tenant_id);
