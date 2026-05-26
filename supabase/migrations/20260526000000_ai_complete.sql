-- FASE 2.2 — IA Expert em Vendas
-- Adiciona colunas de controle de uso à ai_settings e cria tabela de logs

-- ── ai_settings: colunas de controle de uso ──────────────────────────────────

ALTER TABLE public.ai_settings
  ADD COLUMN IF NOT EXISTS monthly_conversation_limit INTEGER NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS current_month_usage        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_reset_at             TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  ADD COLUMN IF NOT EXISTS total_cost_brl             NUMERIC(10,4) NOT NULL DEFAULT 0;

-- ── ai_conversation_logs ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_conversation_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  chat_id       UUID        NOT NULL,
  trigger_type  TEXT        NOT NULL DEFAULT 'manual',
  tokens_input  INTEGER     NOT NULL DEFAULT 0,
  tokens_output INTEGER     NOT NULL DEFAULT 0,
  cost_brl      NUMERIC(10,6) NOT NULL DEFAULT 0,
  requires_handoff BOOLEAN  NOT NULL DEFAULT false,
  sent_auto     BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_conversation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_ai_logs" ON public.ai_conversation_logs
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_ai_logs_tenant_created
  ON public.ai_conversation_logs(tenant_id, created_at DESC);

-- ── reset_monthly_ai_usage ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reset_monthly_ai_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.ai_settings
  SET
    current_month_usage = 0,
    usage_reset_at      = date_trunc('month', now()) + interval '1 month'
  WHERE usage_reset_at <= now();
END;
$$;

-- ── pg_cron: reset dia 1 às 00:05 UTC ────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset-monthly-ai-usage') THEN
    PERFORM cron.schedule(
      'reset-monthly-ai-usage',
      '5 0 1 * *',
      'SELECT public.reset_monthly_ai_usage()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron pode não estar disponível; ignora
  NULL;
END $$;
