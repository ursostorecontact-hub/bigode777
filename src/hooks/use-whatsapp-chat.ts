import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useWhatsAppChats() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['whatsapp-chats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .order('last_message_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-chats-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chats' }, () => {
        qc.invalidateQueries({ queryKey: ['whatsapp-chats'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return query;
}

export function useWhatsAppMessages(chatId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['whatsapp-messages', chatId],
    queryFn: async () => {
      if (!chatId) return [];
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!chatId,
  });

  // Subscribe to realtime changes for this chat
  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel(`whatsapp-messages-${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `chat_id=eq.${chatId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['whatsapp-messages', chatId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId, qc]);

  return query;
}

export function useSendWhatsAppMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      chatId,
      content,
      messageType = 'text',
      mediaBase64,
      mediaMimetype,
      mediaFilename,
    }: {
      chatId: string;
      content: string;
      messageType?: string;
      mediaBase64?: string;
      mediaMimetype?: string;
      mediaFilename?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'send',
            chat_id: chatId,
            content,
            message_type: messageType,
            media_base64: mediaBase64,
            media_mimetype: mediaMimetype,
            media_filename: mediaFilename,
          }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['whatsapp-messages', vars.chatId] });
      qc.invalidateQueries({ queryKey: ['whatsapp-chats'] });
    },
  });
}

export function useMarkChatRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (chatId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: 'mark_read', chat_id: chatId }),
        }
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-chats'] });
    },
  });
}
