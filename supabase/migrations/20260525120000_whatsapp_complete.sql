-- Migration: whatsapp_complete
-- Adiciona: is_group, push_name, custom_name, health columns, media metadata, tipo constraint, índices, bucket

-- ── 1. whatsapp_chats: grupo, push_name, custom_name, foto, auditoria ──────

ALTER TABLE public.whatsapp_chats
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN NOT NULL DEFAULT false;

-- Backfill baseado no JID
UPDATE public.whatsapp_chats
  SET is_group = true
  WHERE remote_jid LIKE '%@g.us';

ALTER TABLE public.whatsapp_chats
  ADD COLUMN IF NOT EXISTS push_name TEXT;

ALTER TABLE public.whatsapp_chats
  ADD COLUMN IF NOT EXISTS custom_name TEXT;

ALTER TABLE public.whatsapp_chats
  ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;

ALTER TABLE public.whatsapp_chats
  ADD COLUMN IF NOT EXISTS custom_name_updated_by UUID REFERENCES auth.users(id);

ALTER TABLE public.whatsapp_chats
  ADD COLUMN IF NOT EXISTS custom_name_updated_at TIMESTAMPTZ;

-- ── 2. whatsapp_instances: saúde do webhook ───────────────────────────────

ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS webhook_url TEXT;

ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS webhook_verified_at TIMESTAMPTZ;

ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS webhook_last_error TEXT;

ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMPTZ;

-- ── 3. whatsapp_messages: metadados de mídia ─────────────────────────────

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_mime_type TEXT;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_size_bytes INTEGER;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_duration_seconds INTEGER;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_filename TEXT;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_caption TEXT;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_thumbnail_base64 TEXT;

-- ── 4. Constraint de tipo de mensagem (expandida) ─────────────────────────

ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_message_type_check;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_message_type_check
  CHECK (message_type IN (
    'text', 'image', 'video', 'audio', 'document', 'sticker',
    'location', 'contact', 'reaction', 'system', 'unsupported'
  ));

-- ── 5. Índices ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_is_group
  ON public.whatsapp_chats(tenant_id, is_group);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_health
  ON public.whatsapp_instances(tenant_id, last_health_check);

-- ── 6. Storage bucket ─────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
  VALUES ('whatsapp-media', 'whatsapp-media', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read whatsapp-media" ON storage.objects;
CREATE POLICY "Public read whatsapp-media" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'whatsapp-media');
