
-- Chats table
CREATE TABLE public.whatsapp_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  remote_jid TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  unread_count INTEGER NOT NULL DEFAULT 0,
  assigned_to UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(whatsapp_instance_id, remote_jid)
);

ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all chats"
ON public.whatsapp_chats FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Salespeople read assigned chats"
ON public.whatsapp_chats FOR SELECT TO authenticated
USING (assigned_to = auth.uid());

CREATE POLICY "Salespeople update assigned chats"
ON public.whatsapp_chats FOR UPDATE TO authenticated
USING (assigned_to = auth.uid());

-- Messages table
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.whatsapp_chats(id) ON DELETE CASCADE,
  from_me BOOLEAN NOT NULL DEFAULT false,
  remote_jid TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  evolution_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all messages"
ON public.whatsapp_messages FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Salespeople read messages from assigned chats"
ON public.whatsapp_messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.whatsapp_chats
  WHERE whatsapp_chats.id = whatsapp_messages.chat_id
  AND whatsapp_chats.assigned_to = auth.uid()
));

CREATE POLICY "Salespeople insert messages to assigned chats"
ON public.whatsapp_messages FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.whatsapp_chats
  WHERE whatsapp_chats.id = whatsapp_messages.chat_id
  AND whatsapp_chats.assigned_to = auth.uid()
));

-- Indexes
CREATE INDEX idx_whatsapp_chats_assigned ON public.whatsapp_chats(assigned_to);
CREATE INDEX idx_whatsapp_chats_instance ON public.whatsapp_chats(whatsapp_instance_id);
CREATE INDEX idx_whatsapp_messages_chat ON public.whatsapp_messages(chat_id);
CREATE INDEX idx_whatsapp_messages_created ON public.whatsapp_messages(created_at);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
