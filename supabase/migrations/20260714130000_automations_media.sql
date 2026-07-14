-- Adiciona suporte a mídia (áudio, foto, vídeo, documento) nas mensagens de automação do funil
ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('audio', 'image', 'video', 'document')),
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_mimetype TEXT;
