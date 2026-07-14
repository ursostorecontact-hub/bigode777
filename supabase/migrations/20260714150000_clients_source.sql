-- Adiciona a origem do cliente (de onde ele veio: WhatsApp, Facebook, Indicação, etc)
-- Isso permite mostrar uma nuvem real de "de onde vêm os compradores" em vez de
-- só extrair palavras soltas do nome.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS source TEXT;

-- Preenche a origem dos clientes já existentes copiando do lead de origem
UPDATE public.clients c
SET source = l.source
FROM public.leads l
WHERE c.lead_id = l.id AND c.source IS NULL;
