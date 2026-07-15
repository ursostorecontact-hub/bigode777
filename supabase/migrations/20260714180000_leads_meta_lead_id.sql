-- Guarda o lead_id real gerado pela Meta de forma estruturada (não só dentro de
-- um texto em "notes"), para poder mandar de volta pra Meta as mudanças de estágio
-- do lead, seguindo a "Integração de leads qualificados" da Meta.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_lead_id TEXT;

-- Recupera o meta_lead_id de leads que já existem, extraindo do texto salvo antes
-- em "notes" (formato "Facebook Lead ID: 1234567890123456")
UPDATE public.leads
SET meta_lead_id = substring(notes FROM 'Facebook Lead ID: (\d+)')
WHERE meta_lead_id IS NULL
  AND notes ~ 'Facebook Lead ID: \d+';
