-- Limite de leads ativos configurável por vendedor. Quando NULL, usa o padrão (20).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_active_leads INTEGER;
