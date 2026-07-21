import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

export function useWhatsAppChats() {
  const { user } = useAuth();
  const { activeTenantId } = useTenant();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['whatsapp-chats', activeTenantId],
    queryFn: async () => {
      let q = supabase.from('whatsapp_chats').select('*');
      if (activeTenantId) q = q.eq('tenant_id', activeTenantId);
      const { data, error } = await q.order('last_message_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: 20000, // Poll every 20s as fallback (realtime ja cobre a maioria)
  });

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
    refetchInterval: 15000, // Poll every 15s as fallback for active chat
  });

  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel(`whatsapp-messages-${chatId}`)
      .on('postgres_changes', {
        event: '*',
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

export function useDeleteWhatsAppMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, chatId, deleteForEveryone = true }: { messageId: string; chatId: string; deleteForEveryone?: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: 'delete_message', message_id: messageId, delete_for_everyone: deleteForEveryone }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['whatsapp-messages', vars.chatId] });
    },
  });
}
