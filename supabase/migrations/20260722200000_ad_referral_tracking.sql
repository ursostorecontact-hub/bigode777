-- Guarda o metadado real de anúncio (click-to-WhatsApp) que o WhatsApp anexa
-- na primeira mensagem quando alguém clica em "Enviar mensagem" num anúncio
-- do Facebook/Instagram. Sem essas colunas, o CRM não tinha onde guardar essa
-- informação e dependia só da IA "advinhando" pelo texto da conversa.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ad_title TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ad_source_url TEXT;

ALTER TABLE public.whatsapp_chats ADD COLUMN IF NOT EXISTS ad_title TEXT;
ALTER TABLE public.whatsapp_chats ADD COLUMN IF NOT EXISTS ad_source_url TEXT;
