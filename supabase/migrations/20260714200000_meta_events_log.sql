-- Registro de auditoria de TODO evento enviado à Meta (Purchase, Qualified, Lead status),
-- com sucesso ou erro, para permitir conferência e reenvio manual em caso de falha.
CREATE TABLE public.meta_events_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  event_source TEXT NOT NULL, -- 'purchase' | 'lead_status' | 'qualified'
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_events_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tenant meta events"
  ON public.meta_events_log FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

CREATE INDEX idx_meta_events_log_tenant ON public.meta_events_log(tenant_id, created_at DESC);
CREATE INDEX idx_meta_events_log_status ON public.meta_events_log(status);
