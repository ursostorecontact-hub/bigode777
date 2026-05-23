-- 2026-05-23: ai_settings table + restrict catalog writes to admin/manager

-- ── AI Settings (one row per tenant) ─────────────────────────────────────────

CREATE TABLE public.ai_settings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  ai_enabled BOOLEAN     NOT NULL DEFAULT false,
  ai_mode    TEXT        NOT NULL DEFAULT 'suggestion',
  custom_personality TEXT NOT NULL DEFAULT '',
  work_start TEXT        NOT NULL DEFAULT '08:00',
  work_end   TEXT        NOT NULL DEFAULT '18:00',
  escalation_keywords TEXT NOT NULL DEFAULT 'reclamação, cancelar, reembolso, devolução, procon',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- All tenant members can read their own AI settings
CREATE POLICY "Tenant members read ai_settings" ON public.ai_settings
  FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() OR is_super_admin());

-- Only admin/manager can write
CREATE POLICY "Tenant admins manage ai_settings" ON public.ai_settings
  FOR ALL TO authenticated
  USING (
    (tenant_id = current_tenant_id()
      AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
    OR is_super_admin()
  )
  WITH CHECK (
    (tenant_id = current_tenant_id()
      AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
    OR is_super_admin()
  );

CREATE INDEX idx_ai_settings_tenant_id ON public.ai_settings(tenant_id);

-- Trigger to keep updated_at fresh
CREATE TRIGGER update_ai_settings_updated_at
  BEFORE UPDATE ON public.ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ── Fix catalog write RLS: restrict to admin/manager ─────────────────────────
-- The original "Tenant admins manage *" policies used only tenant_id check,
-- which allowed salesperson to mutate catalog rows.

DROP POLICY IF EXISTS "Tenant admins manage products" ON public.products;
DROP POLICY IF EXISTS "Tenant admins manage categories" ON public.product_categories;
DROP POLICY IF EXISTS "Tenant admins manage variants" ON public.product_variants;

CREATE POLICY "Tenant admins manage products" ON public.products
  FOR ALL TO authenticated
  USING (
    (tenant_id = current_tenant_id()
      AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
    OR is_super_admin()
  )
  WITH CHECK (
    (tenant_id = current_tenant_id()
      AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
    OR is_super_admin()
  );

CREATE POLICY "Tenant admins manage categories" ON public.product_categories
  FOR ALL TO authenticated
  USING (
    (tenant_id = current_tenant_id()
      AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
    OR is_super_admin()
  )
  WITH CHECK (
    (tenant_id = current_tenant_id()
      AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
    OR is_super_admin()
  );

CREATE POLICY "Tenant admins manage variants" ON public.product_variants
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variants.product_id
      AND (
        (p.tenant_id = current_tenant_id()
          AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
        OR is_super_admin()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variants.product_id
      AND (
        (p.tenant_id = current_tenant_id()
          AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
        OR is_super_admin()
      )
    )
  );
