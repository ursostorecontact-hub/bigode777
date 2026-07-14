-- Mensagens rápidas (quick replies) acionadas com "/" no chat do WhatsApp
CREATE TABLE public.quick_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID DEFAULT current_tenant_id(),
  shortcut TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'audio', 'document')),
  content TEXT,
  media_url TEXT,
  media_mimetype TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, shortcut)
);

ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

-- Usuários gerenciam suas próprias mensagens rápidas
CREATE POLICY "Users manage own quick replies"
  ON public.quick_replies FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins/gestores podem ver todas as mensagens rápidas do tenant
CREATE POLICY "Admins view all quick replies"
  ON public.quick_replies FOR SELECT
  TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  );

CREATE INDEX idx_quick_replies_user ON public.quick_replies(user_id);
CREATE INDEX idx_quick_replies_tenant ON public.quick_replies(tenant_id);
CREATE INDEX idx_quick_replies_shortcut ON public.quick_replies(user_id, shortcut);

CREATE TRIGGER update_quick_replies_updated_at
  BEFORE UPDATE ON public.quick_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket para mídia das mensagens rápidas (áudio, vídeo, foto)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quick-reply-media',
  'quick-reply-media',
  true,
  20971520, -- 20 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/webm']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read quick reply media" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'quick-reply-media');

CREATE POLICY "Authenticated upload quick reply media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'quick-reply-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated delete own quick reply media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'quick-reply-media' AND auth.uid()::text = (storage.foldername(name))[1]);
