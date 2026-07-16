-- Pontuação de interesse/intenção de compra, calculada automaticamente por IA
-- toda vez que um lead é criado ou muda de etapa/status.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_score INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_temperature TEXT CHECK (ai_temperature IN ('quente', 'morno', 'frio'));
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_score_reason TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_scored_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_ai_temperature ON public.leads(ai_temperature);
