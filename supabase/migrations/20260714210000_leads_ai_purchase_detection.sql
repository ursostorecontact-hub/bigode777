-- A IA sinaliza quando detecta, pela conversa, que a venda parece ter sido fechada,
-- junto com uma estimativa de valor (se mencionado). O vendedor confirma com 1 clique
-- (não vira venda de verdade sozinho, pra nunca mandar dado de venda falso pro Facebook).
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_purchase_detected BOOLEAN DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_purchase_value_hint NUMERIC;
